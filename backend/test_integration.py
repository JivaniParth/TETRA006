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

if __name__ == "__main__":
    # Add aiofiles / aiosqlite to requirements if running locally, or just run the test suite
    import pip
    try:
        import aiosqlite
    except ImportError:
        print("Installing aiosqlite dependency for memory tests...")
        pip.main(["install", "aiosqlite"])
    
    unittest.main()
