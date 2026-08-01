import asyncio
import sys
import unittest
from datetime import datetime
from typing import Dict, Any, List

# Add current path to import app correctly
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Configure test environment before imports
os.environ["POSTGRES_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["REDIS_URL"] = "redis://localhost:6379/9"  # Use separate DB for testing
os.environ["GEMINI_API_KEYS"] = "placeholder_key"
os.environ["KAFKA_BROKERS"] = "localhost:9092"

from fastapi.testclient import TestClient
from app.main import app
from app.db.postgres import Base, engine, AsyncSessionLocal
from app.services.safety import (
    calculate_ascvd,
    calculate_findrisc,
    calculate_ckd_epi,
    run_bp_staging,
    check_med_allergy_interactions
)
from app.services.rules import fallback_classify

class TestMedGuardDeterministicSafety(unittest.TestCase):
    def test_blood_pressure_staging(self):
        # Normal
        res = run_bp_staging(115, 75)
        self.assertEqual(res["stage"], "Normal")

        # Elevated
        res = run_bp_staging(125, 78)
        self.assertEqual(res["stage"], "Elevated")

        # Stage 1
        res = run_bp_staging(135, 82)
        self.assertEqual(res["stage"], "Stage 1 Hypertension")

        # Stage 2
        res = run_bp_staging(145, 95)
        self.assertEqual(res["stage"], "Stage 2 Hypertension")

        # Crisis
        res = run_bp_staging(185, 125)
        self.assertEqual(res["stage"], "Hypertensive Crisis (Emergency)")

    def test_ckd_epi_gfr(self):
        # Female, age 50, creatinine 0.6 (Normal)
        profile = {"age": 50, "gender": "female"}
        res = calculate_ckd_epi(profile, creatinine=0.6)
        self.assertIsNotNone(res["egfr"])
        self.assertGreater(res["egfr"], 90.0)
        self.assertEqual(res["stage"], "G1 (Normal/High)")

        # Male, age 65, creatinine 2.5 (Severe decrease)
        profile = {"age": 65, "gender": "male"}
        res = calculate_ckd_epi(profile, creatinine=2.5)
        self.assertIsNotNone(res["egfr"])
        self.assertLess(res["egfr"], 30.0)
        self.assertEqual(res["stage"], "G4 (Severely Decreased)")

    def test_findrisc_score(self):
        profile = {
            "age": 55,
            "weight": 95.0, # BMI > 30
            "height": 170.0,
            "lifestyle_active": False,
            "bp_treated": True,
            "fasting_blood_glucose": 115.0,
            "family_history_diabetes": True
        }
        res = calculate_findrisc(profile)
        # Verify it calculates a high/moderate category
        self.assertIn(res["category"], ["moderate", "high"])
        self.assertGreaterEqual(res["score"], 15)

    def test_ascvd_risk(self):
        profile = {
            "age": 60,
            "gender": "male",
            "race": "white",
            "total_cholesterol": 240.0,
            "hdl_cholesterol": 38.0,
            "systolic_bp": 150,
            "bp_treated": True,
            "lifestyle_smoke": True,
            "family_history_diabetes": True
        }
        res = calculate_ascvd(profile)
        self.assertEqual(res["status"], "calculated")
        self.assertIsNotNone(res["score"])
        self.assertEqual(res["category"], "high")

    def test_med_allergy_interactions(self):
        # Test Warfarin + Aspirin interaction
        meds = ["Warfarin", "Atorvastatin", "Aspirin"]
        allergies = ["Sulfa"]
        warnings = check_med_allergy_interactions(meds, allergies)
        self.assertTrue(any("CRITICAL DRUG INTERACTION" in w and "WARFARIN" in w and "ASPIRIN" in w for w in warnings))

        # Test Penicillin allergy + Amoxicillin medication
        meds = ["Amoxicillin"]
        allergies = ["Penicillin"]
        warnings = check_med_allergy_interactions(meds, allergies)
        self.assertTrue(any("CRITICAL ALLERGY ALERT" in w and "PENICILLIN" in w and "AMOXICILLIN" in w for w in warnings))


class TestFallbackClassifier(unittest.TestCase):
    def test_fallback_urgency_detection(self):
        # Severe chest pain query -> urgent
        query = "I have been having crushing chest pain and shortness of breath for the last 2 hours"
        res = fallback_classify(query)
        self.assertEqual(res["urgency"], "urgent")
        self.assertEqual(res["body_part"], "chest")
        self.assertEqual(res["duration"], "2 hours")
        self.assertEqual(len(res["missing_fields"]), 0)

        # Routine symptom query with missing details -> routine + missing fields
        query = "My stomach hurts"
        res = fallback_classify(query)
        self.assertEqual(res["urgency"], "routine")
        self.assertEqual(res["body_part"], "abdomen")
        self.assertIsNone(res["duration"])
        self.assertIn("duration", res["missing_fields"])


class TestAPIFlows(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # Import dynamic SQLite support to compile tables in memory
        import aiosqlite
        # Initialize Database tables in SQLite memory
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        self.client = TestClient(app)

    async def test_health_endpoint(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

    async def test_register_login_flow(self):
        # 1. Register a test patient
        reg_payload = {
            "email": "test_patient@medguard.com",
            "password": "securepassword123",
            "role": "patient"
        }
        res = self.client.post("/auth/register", json=reg_payload)
        self.assertEqual(res.status_code, 201)
        self.assertIn("access_token", res.json())
        token = res.json()["access_token"]

        # 2. Login
        login_payload = {
            "email": "test_patient@medguard.com",
            "password": "securepassword123"
        }
        res = self.client.post("/auth/login", json=login_payload)
        self.assertEqual(res.status_code, 200)
        self.assertIn("access_token", res.json())

        # 3. Create clinician
        reg_clinician = {
            "email": "doctor@medguard.com",
            "password": "doctorpassword123",
            "role": "clinician"
        }
        res = self.client.post("/auth/register", json=reg_clinician)
        self.assertEqual(res.status_code, 201)

    async def test_otp_and_history_flows(self):
        # 1. Register a test patient and log in
        reg_payload = {
            "email": "pat_otp@medguard.com",
            "password": "securepassword123",
            "role": "patient"
        }
        res = self.client.post("/auth/register", json=reg_payload)
        self.assertEqual(res.status_code, 201)
        token = res.json()["access_token"]
        patient_id = res.json()["user_id"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create patient profile with additional_notes
        prof_payload = {
            "age": 45,
            "gender": "male",
            "race": "asian",
            "height": 175.0,
            "weight": 75.0,
            "systolic_bp": 120,
            "diastolic_bp": 80,
            "fasting_blood_glucose": 90.0,
            "active_medications": ["aspirin"],
            "allergies": ["penicillin"],
            "additional_notes": "Patient notes"
        }
        res = self.client.post(f"/patient/{patient_id}/profile", json=prof_payload, headers=headers)
        self.assertEqual(res.status_code, 200)

        # Log a vital with blood_sugar_type
        vital_payload = {
            "systolic_bp": 122,
            "diastolic_bp": 81,
            "blood_sugar": 105.0,
            "blood_sugar_type": "fasting",
            "creatinine": 0.8,
            "heart_rate": 72
        }
        res = self.client.post(f"/patient/{patient_id}/vitals", json=vital_payload, headers=headers)
        self.assertEqual(res.status_code, 201)

        # Get vitals timeline
        res = self.client.get(f"/patient/{patient_id}/vitals/timeline", headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()), 1)
        self.assertEqual(res.json()[0]["blood_sugar_type"], "fasting")

        # Get nearby hospitals suggestions
        res = self.client.get("/patient/hospitals/nearby?latitude=12.92&longitude=77.60", headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertGreaterEqual(len(res.json()), 1)
        self.assertIn("distance_km", res.json()[0])

        # Generate OTP and mock Redis validation for the test using AsyncMock
        from unittest.mock import MagicMock, AsyncMock
        from app.db.redis import redis_manager
        old_client = redis_manager.client
        old_rate_limit = redis_manager.is_rate_limited
        
        mock_redis = MagicMock()
        mock_redis.get = AsyncMock(return_value=patient_id)
        mock_redis.setex = AsyncMock(return_value=True)
        mock_redis.delete = AsyncMock(return_value=True)
        
        redis_manager.client = mock_redis
        redis_manager.is_rate_limited = AsyncMock(return_value=False)

        try:
            res = self.client.post("/patient/access-code/generate", headers=headers)
            self.assertEqual(res.status_code, 200)
            otp_code = res.json()["otp_code"]
            self.assertEqual(len(otp_code), 6)

            # Clinician registration and login
            reg_clinician = {
                "email": "doc_otp@medguard.com",
                "password": "doctorpassword123",
                "role": "clinician"
            }
            res = self.client.post("/auth/register", json=reg_clinician)
            self.assertEqual(res.status_code, 201)
            doc_token = res.json()["access_token"]
            doc_headers = {"Authorization": f"Bearer {doc_token}"}

            # 2. Clinician retrieve patient history with email and OTP code
            clin_access_body = {
                "patient_email": "pat_otp@medguard.com",
                "otp_code": otp_code
            }
            res = self.client.post("/clinician/patient-history", json=clin_access_body, headers=doc_headers)
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["email"], "pat_otp@medguard.com")
            self.assertEqual(res.json()["profile"]["additional_notes"], "Patient notes")

            # 3. Clinician update patient medications/operations with email and OTP code
            clin_update_body = {
                "patient_email": "pat_otp@medguard.com",
                "otp_code": otp_code,
                "active_medications": ["lisinopril"],
                "past_operations": ["appendix"]
            }
            res = self.client.post("/clinician/patient-history/update", json=clin_update_body, headers=doc_headers)
            self.assertEqual(res.status_code, 200)
        finally:
            # Restore redis manager
            redis_manager.client = old_client
            redis_manager.is_rate_limited = old_rate_limit

    async def test_query_markdown_parsing(self):
        # 1. Register and log in
        reg_payload = {
            "email": "query_test@medguard.com",
            "password": "securepassword123",
            "role": "patient"
        }
        res = self.client.post("/auth/register", json=reg_payload)
        self.assertEqual(res.status_code, 201)
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Mock medgemma response
        from unittest.mock import AsyncMock
        from app.services.llm import medgemma_client
        old_call = medgemma_client.call_medgemma
        medgemma_client.call_medgemma = AsyncMock(return_value="**Bold Text** with list:\n* Item 1\n* Item 2")

        try:
            # Send clinical query
            query_payload = {
                "text": "General routine health check",
                "session_id": "test-session-123"
            }
            res = self.client.post("/query", json=query_payload, headers=headers)
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["response"], "**Bold Text** with list:\n* Item 1\n* Item 2")
            # Verify parsed html
            self.assertIn("<strong>Bold Text</strong>", data["html_response"])
            self.assertIn("<li>Item 1</li>", data["html_response"])
        finally:
            medgemma_client.call_medgemma = old_call

    async def test_emergency_alert_flows(self):
        # 1. Register a Patient
        pat_payload = {
            "email": "emergency_patient@medguard.com",
            "password": "securepassword123",
            "role": "patient"
        }
        res = self.client.post("/auth/register", json=pat_payload)
        self.assertEqual(res.status_code, 201)
        pat_token = res.json()["access_token"]
        pat_id = res.json()["user_id"]
        pat_headers = {"Authorization": f"Bearer {pat_token}"}

        # 2. Register a Clinician
        clin_payload = {
            "email": "emergency_clinician@medguard.com",
            "password": "securepassword123",
            "role": "clinician"
        }
        res = self.client.post("/auth/register", json=clin_payload)
        self.assertEqual(res.status_code, 201)
        clin_token = res.json()["access_token"]
        clin_headers = {"Authorization": f"Bearer {clin_token}"}

        # 3. Patient triggers emergency broadcast alert
        alert_payload = {
            "latitude": 12.9230,
            "longitude": 77.5990
        }
        res = self.client.post(f"/patient/{pat_id}/emergency", json=alert_payload, headers=pat_headers)
        self.assertEqual(res.status_code, 201)
        alert_data = res.json()
        self.assertEqual(alert_data["status"], "pending")
        alert_id = alert_data["id"]

        # 4. Check active emergency status
        res = self.client.get(f"/patient/{pat_id}/emergency/active", headers=pat_headers)
        self.assertEqual(res.status_code, 200)
        self.assertIsNotNone(res.json())
        self.assertEqual(res.json()["status"], "pending")

        # 5. Clinician lists emergencies (specifying hospital coordinates, e.g. Apollo at 12.9238, 77.5996)
        res = self.client.get("/clinician/emergencies?latitude=12.9238&longitude=77.5996", headers=clin_headers)
        self.assertEqual(res.status_code, 200)
        alerts_list = res.json()
        self.assertGreater(len(alerts_list), 0)
        # Verify distance is computed
        self.assertIsNotNone(alerts_list[0]["distance_km"])
        self.assertEqual(alerts_list[0]["id"], alert_id)

        # 6. Clinician accepts the emergency alert
        accept_payload = {
            "hospital_name": "Apollo Hospitals Bangalore",
            "phone": "+91 80 2630 4050"
        }
        res = self.client.post(f"/clinician/emergencies/{alert_id}/accept", json=accept_payload, headers=clin_headers)
        self.assertEqual(res.status_code, 200)
        accepted_alert = res.json()
        self.assertEqual(accepted_alert["status"], "accepted")
        self.assertEqual(accepted_alert["accepted_by_hospital"], "Apollo Hospitals Bangalore")

        # 7. Verify accepted alert is removed from active pending emergencies
        res = self.client.get("/clinician/emergencies?latitude=12.9238&longitude=77.5996", headers=clin_headers)
        self.assertEqual(res.status_code, 200)
        # Should be empty since it is accepted
        self.assertEqual(len(res.json()), 0)

        # 8. Check patient status shows the accepted hospital info
        res = self.client.get(f"/patient/{pat_id}/emergency/active", headers=pat_headers)
        self.assertEqual(res.status_code, 200)
        self.assertIsNotNone(res.json())
        self.assertEqual(res.json()["status"], "accepted")
        self.assertEqual(res.json()["accepted_by_hospital"], "Apollo Hospitals Bangalore")

if __name__ == "__main__":
    # Add aiofiles / aiosqlite to requirements if running locally, or just run the test suite
    import pip
    try:
        import aiosqlite
    except ImportError:
        print("Installing aiosqlite dependency for memory tests...")
        pip.main(["install", "aiosqlite"])
    
    unittest.main()
