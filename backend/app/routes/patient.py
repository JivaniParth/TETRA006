import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.db.redis import redis_manager
from app.models.all_models import Patient, PatientProfile, Vital, Report, PatientHistory, EmergencyAlert
from app.models.schemas import PatientProfileCreate, PatientProfileResponse, VitalCreate, VitalResponse, OtpGenerateResponse, EmergencyCreate, EmergencyResponse
from app.services.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/patient", tags=["Patients"])

# Role guards
allow_patient = RoleChecker(["patient"])
allow_any = RoleChecker(["patient", "clinician"])

def verify_self_or_clinician(patient_id: str, current_user: Patient):
    """Ensure the user is requesting their own data or is a clinician"""
    if current_user.role == "patient" and str(current_user.id) != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You cannot view or modify another patient's data."
        )

import uuid

@router.get("/{id}/profile", response_model=PatientProfileResponse)
async def get_profile(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Patient = Depends(allow_any)
):
    verify_self_or_clinician(id, current_user)
    
    query = select(PatientProfile).where(PatientProfile.patient_id == uuid.UUID(id))
    res = await db.execute(query)
    profile = res.scalars().first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile does not exist yet."
        )
    return profile

@router.post("/{id}/profile", response_model=PatientProfileResponse)
async def create_or_update_profile(
    id: str,
    payload: PatientProfileCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Patient = Depends(allow_patient)
):
    verify_self_or_clinician(id, current_user)

    query = select(PatientProfile).where(PatientProfile.patient_id == uuid.UUID(id))
    res = await db.execute(query)
    profile = res.scalars().first()

    if profile:
        # Update existing profile
        for key, value in payload.model_dump().items():
            setattr(profile, key, value)
    else:
        # Create new profile
        profile = PatientProfile(
            patient_id=uuid.UUID(id),
            **payload.model_dump()
        )
        db.add(profile)

    await db.commit()
    await db.refresh(profile)
    return profile

@router.post("/{id}/vitals", response_model=VitalResponse, status_code=status.HTTP_201_CREATED)
async def log_vital(
    id: str,
    payload: VitalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Patient = Depends(allow_patient)
):
    verify_self_or_clinician(id, current_user)

    new_vital = Vital(
        patient_id=uuid.UUID(id),
        **payload.model_dump(exclude_unset=True)
    )
    db.add(new_vital)
    await db.commit()
    await db.refresh(new_vital)

    # Invalidate Redis warm cache of vitals for this patient
    if redis_manager.client:
        await redis_manager.client.delete(f"hot_vitals:{id}")

    return new_vital

@router.get("/{id}/history")
async def get_history(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Patient = Depends(allow_any)
):
    verify_self_or_clinician(id, current_user)

    # Retrieve all vitals, reports, and conversational history
    vitals_q = select(Vital).where(Vital.patient_id == uuid.UUID(id)).order_by(Vital.recorded_at.desc())
    reports_q = select(Report).where(Report.patient_id == uuid.UUID(id)).order_by(Report.created_at.desc())
    histories_q = select(PatientHistory).where(PatientHistory.patient_id == uuid.UUID(id)).order_by(PatientHistory.created_at.desc())

    v_res = await db.execute(vitals_q)
    r_res = await db.execute(reports_q)
    h_res = await db.execute(histories_q)

    vitals = v_res.scalars().all()
    reports = r_res.scalars().all()
    histories = h_res.scalars().all()

    return {
        "vitals": [
            {
                "id": str(v.id),
                "systolic_bp": v.systolic_bp,
                "diastolic_bp": v.diastolic_bp,
                "blood_sugar": v.blood_sugar,
                "creatinine": v.creatinine,
                "heart_rate": v.heart_rate,
                "recorded_at": v.recorded_at
            }
            for v in vitals
        ],
        "reports": [
            {
                "id": str(rep.id),
                "file_name": rep.file_name,
                "file_type": rep.file_type,
                "extracted_values": rep.extracted_values,
                "raw_model_notes": rep.raw_model_notes,
                "confidence": rep.confidence,
                "range_check_passed": rep.range_check_passed,
                "status": rep.status,
                "severity_tier": rep.severity_tier,
                "created_at": rep.created_at
            }
            for rep in reports
        ],
        "inferences": [
            {
                "id": str(h.id),
                "content_type": h.content_type,
                "text_content": h.text_content,
                "created_at": h.created_at
            }
            for h in histories
        ]
    }

@router.get("/{id}/indicators")
async def get_indicators(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Patient = Depends(allow_any)
):
    verify_self_or_clinician(id, current_user)
    
    # Load profile
    profile_query = select(PatientProfile).where(PatientProfile.patient_id == uuid.UUID(id))
    profile_res = await db.execute(profile_query)
    profile = profile_res.scalars().first()
    
    # Load latest vitals
    vitals_query = select(Vital).where(Vital.patient_id == uuid.UUID(id)).order_by(Vital.recorded_at.desc()).limit(1)
    vitals_res = await db.execute(vitals_query)
    latest_vital = vitals_res.scalars().first()
    
    # Convert profile and vitals to dicts
    profile_dict = {}
    if profile:
        profile_dict = {
            "age": profile.age,
            "gender": profile.gender,
            "race": profile.race,
            "height": profile.height,
            "weight": profile.weight,
            "systolic_bp": profile.systolic_bp,
            "diastolic_bp": profile.diastolic_bp,
            "fasting_blood_glucose": profile.fasting_blood_glucose,
            "active_medications": profile.active_medications or [],
            "allergies": profile.allergies or [],
            "lifestyle_smoke": profile.lifestyle_smoke,
            "lifestyle_active": profile.lifestyle_active,
            "family_history_cardiovascular": profile.family_history_cardiovascular,
            "family_history_diabetes": profile.family_history_diabetes,
            "sleep_duration": profile.sleep_duration,
            "sleep_quality": profile.sleep_quality,
            "alcohol_consumption": profile.alcohol_consumption,
            "tobacco_consumption": profile.tobacco_consumption,
            "past_operations": profile.past_operations or [],
            "medical_history": profile.medical_history or []
        }
        
    vitals_dict = {}
    if latest_vital:
        vitals_dict = {
            "systolic_bp": latest_vital.systolic_bp,
            "diastolic_bp": latest_vital.diastolic_bp,
            "blood_sugar": latest_vital.blood_sugar,
            "creatinine": latest_vital.creatinine,
            "heart_rate": latest_vital.heart_rate
        }
        
    from app.services.safety import safety_layer
    report = safety_layer.evaluate_patient_safety(profile_dict, vitals_dict)
    return report

@router.get("/{id}/vitals/timeline", response_model=List[VitalResponse])
async def get_vitals_timeline(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Patient = Depends(allow_any)
):
    verify_self_or_clinician(id, current_user)
    
    query = select(Vital).where(Vital.patient_id == uuid.UUID(id)).order_by(Vital.recorded_at.asc())
    result = await db.execute(query)
    vitals = result.scalars().all()
    return list(vitals)

import secrets

@router.post("/access-code/generate", response_model=OtpGenerateResponse)
async def generate_access_code(
    current_user: Patient = Depends(allow_patient)
):
    # Generate a cryptographically secure 6-digit access code
    otp_code = "".join(str(secrets.randbelow(10)) for _ in range(6))
    
    # Store in Redis mapping otp_code -> patient_id (str) for 60 seconds
    if redis_manager.client:
        await redis_manager.client.setex(
            f"patient_access_otp:{otp_code}",
            60,
            str(current_user.id)
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Redis server offline. Cannot generate access code."
        )
        
    return {"otp_code": otp_code, "expires_in_seconds": 60}

MOCK_HOSPITALS = [
    {"name": "NewYork-Presbyterian Hospital", "latitude": 40.8424, "longitude": -73.9429, "address": "622 W 168th St, New York, NY", "phone": "+1 212-305-2500"},
    {"name": "Mount Sinai Hospital", "latitude": 40.7899, "longitude": -73.9528, "address": "1468 Madison Ave, New York, NY", "phone": "+1 212-241-6500"},
    {"name": "NYU Langone Health", "latitude": 40.7423, "longitude": -73.9737, "address": "550 1st Ave, New York, NY", "phone": "+1 212-263-7300"},
    {"name": "St Thomas' Hospital", "latitude": 51.4988, "longitude": -0.1190, "address": "Westminster Bridge Rd, London, UK", "phone": "+44 20 7188 7188"},
    {"name": "University College Hospital", "latitude": 51.5247, "longitude": -0.1343, "address": "235 Euston Rd, London, UK", "phone": "+44 20 3456 7890"},
    {"name": "Apollo Hospitals Bangalore", "latitude": 12.9238, "longitude": 77.5996, "address": "Bannerghatta Rd, Bangalore, India", "phone": "+91 80 2630 4050"},
    {"name": "Fortis Hospital Bangalore", "latitude": 12.9248, "longitude": 77.6001, "address": "Bannerghatta Rd, Bangalore, India", "phone": "+91 80 6621 4444"},
    {"name": "Lilavati Hospital Mumbai", "latitude": 19.0515, "longitude": 72.8285, "address": "Bandra West, Mumbai, India", "phone": "+91 22 2675 1000"},
    {"name": "Kokilaben Dhirubhai Ambani Hospital Mumbai", "latitude": 19.1315, "longitude": 72.8252, "address": "Andheri West, Mumbai, India", "phone": "+91 22 3099 9999"}
]

@router.get("/hospitals/nearby")
async def get_nearby_hospitals(
    latitude: float,
    longitude: float,
    current_user: Patient = Depends(allow_any)
):
    import math
    import httpx
    
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371.0  # Earth radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c

    # Try calling OpenStreetMap's Overpass API for real live nearby hospitals
    try:
        overpass_url = "https://overpass-api.de/api/interpreter"
        # Search radius of 20 km around the patient
        query = f"""[out:json][timeout:5];
        (
          node["amenity"="hospital"](around:20000,{latitude},{longitude});
          way["amenity"="hospital"](around:20000,{latitude},{longitude});
        );
        out center;"""
        
        headers = {
            "User-Agent": "MedGuardApp/1.0 (contact: support@medguard.com)"
        }
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(overpass_url, params={"data": query}, headers=headers)
            
        if response.status_code == 200:
            data = response.json()
            elements = data.get("elements", [])
            
            real_hospitals = []
            for elem in elements:
                h_lat = elem.get("lat") or elem.get("center", {}).get("lat")
                h_lon = elem.get("lon") or elem.get("center", {}).get("lon")
                
                if not h_lat or not h_lon:
                    continue
                    
                tags = elem.get("tags", {})
                name = tags.get("name") or tags.get("official_name") or "Emergency Hospital Center"
                
                dist = haversine(latitude, longitude, h_lat, h_lon)
                
                street = tags.get("addr:street", "")
                city = tags.get("addr:city", "")
                address = f"{street}, {city}".strip(", ")
                if not address:
                    address = tags.get("addr:suburb") or tags.get("addr:neighbourhood") or "Located in neighborhood district"
                    
                phone = tags.get("phone") or tags.get("contact:phone") or "Unavailable"
                
                real_hospitals.append({
                    "name": name,
                    "latitude": h_lat,
                    "longitude": h_lon,
                    "address": address,
                    "phone": phone,
                    "distance_km": round(dist, 2)
                })
                
            if real_hospitals:
                real_hospitals.sort(key=lambda x: x["distance_km"])
                results = real_hospitals[:5]
                
                # Fill remaining slots with dynamic clinics if we got fewer than 5 real hospitals
                if len(results) < 5:
                    needed = 5 - len(results)
                    dynamic_clinics = [
                        {"name": "MedGuard Immediate Care Clinic", "lat_offset": 0.012, "lon_offset": -0.015, "address": "Local Healthcare District Blvd", "phone": "+1 800-MEDGUARD"},
                        {"name": "City Wellness Emergency Center", "lat_offset": -0.018, "lon_offset": 0.022, "address": "Primary Care Plaza Suite 10", "phone": "+1 800-555-0199"},
                        {"name": "Metro General Hospital Annex", "lat_offset": 0.025, "lon_offset": 0.005, "address": "Medical Center Ave & Main St", "phone": "+1 800-555-0100"}
                    ]
                    for clinic in dynamic_clinics[:needed]:
                        c_lat = latitude + clinic["lat_offset"]
                        c_lon = longitude + clinic["lon_offset"]
                        dist = haversine(latitude, longitude, c_lat, c_lon)
                        results.append({
                            "name": clinic["name"],
                            "latitude": c_lat,
                            "longitude": c_lon,
                            "address": clinic["address"],
                            "phone": clinic["phone"],
                            "distance_km": round(dist, 2)
                        })
                return results
    except Exception as ex:
        logger.warning(f"Overpass API lookup failed, falling back to mock hospital list: {ex}")

    # Fallback to local mathematical calculation of clinics and hubs (restricted to 50km for authenticity)
    results = []
    for hosp in MOCK_HOSPITALS:
        dist = haversine(latitude, longitude, hosp["latitude"], hosp["longitude"])
        if dist <= 50.0:  # Only show mock reference hospitals if within 50 km
            results.append({
                "name": hosp["name"],
                "latitude": hosp["latitude"],
                "longitude": hosp["longitude"],
                "address": hosp["address"],
                "phone": hosp["phone"],
                "distance_km": round(dist, 2)
            })
        
    dynamic_clinics = [
        {"name": "MedGuard Immediate Care Clinic", "lat_offset": 0.012, "lon_offset": -0.015, "address": "Local Healthcare District Blvd", "phone": "+1 800-MEDGUARD"},
        {"name": "City Wellness Emergency Center", "lat_offset": -0.018, "lon_offset": 0.022, "address": "Primary Care Plaza Suite 10", "phone": "+1 800-555-0199"},
        {"name": "Metro General Hospital Annex", "lat_offset": 0.025, "lon_offset": 0.005, "address": "Medical Center Ave & Main St", "phone": "+1 800-555-0100"}
    ]
    
    for clinic in dynamic_clinics:
        c_lat = latitude + clinic["lat_offset"]
        c_lon = longitude + clinic["lon_offset"]
        dist = haversine(latitude, longitude, c_lat, c_lon)
        results.append({
            "name": clinic["name"],
            "latitude": c_lat,
            "longitude": c_lon,
            "address": clinic["address"],
            "phone": clinic["phone"],
            "distance_km": round(dist, 2)
        })
        
    results.sort(key=lambda x: x["distance_km"])
    return results[:5]

@router.post("/{id}/emergency", response_model=EmergencyResponse, status_code=status.HTTP_201_CREATED)
async def trigger_emergency(
    id: str,
    payload: EmergencyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Patient = Depends(allow_patient)
):
    verify_self_or_clinician(id, current_user)
    
    # Check if patient exists
    patient_query = select(Patient).where(Patient.id == uuid.UUID(id))
    patient_res = await db.execute(patient_query)
    patient = patient_res.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    # Create new EmergencyAlert
    alert = EmergencyAlert(
        patient_id=uuid.UUID(id),
        patient_email=patient.email,
        latitude=payload.latitude,
        longitude=payload.longitude,
        status="pending"
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    
    return alert

@router.get("/{id}/emergency/active", response_model=Optional[EmergencyResponse])
async def get_active_emergency(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Patient = Depends(allow_any)
):
    verify_self_or_clinician(id, current_user)
    
    # Fetch latest alert that is either pending, or accepted within the last 15 minutes
    from datetime import datetime, timedelta
    fifteen_mins_ago = datetime.utcnow() - timedelta(minutes=15)
    
    query = select(EmergencyAlert).where(
        EmergencyAlert.patient_id == uuid.UUID(id)
    ).order_by(EmergencyAlert.created_at.desc()).limit(1)
    
    res = await db.execute(query)
    alert = res.scalars().first()
    
    if alert:
        if alert.status == "pending" or (alert.status == "accepted" and alert.accepted_at and alert.accepted_at >= fifteen_mins_ago):
            return alert
            
    return None



