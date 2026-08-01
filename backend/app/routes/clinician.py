from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.db.redis import redis_manager
from app.models.all_models import ClinicianEscalation, Patient, PatientProfile, Vital, Report, PatientHistory, EmergencyAlert
from app.models.schemas import (
    EscalationResponse,
    ClinicianAccessHistoryRequest,
    ClinicianUpdateHistoryRequest,
    EmergencyResponse,
    EmergencyAcceptPayload
)
from app.services.auth import RoleChecker

router = APIRouter(prefix="/clinician", tags=["Clinician Dashboard"])
allow_clinician = RoleChecker(["clinician"])

@router.get("/escalations", response_model=List[EscalationResponse])
async def get_escalations(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(allow_clinician)
):
    query = select(ClinicianEscalation).order_by(ClinicianEscalation.created_at.desc())
    res = await db.execute(query)
    escalations = res.scalars().all()
    return list(escalations)

@router.post("/escalations/{id}/resolve")
async def resolve_escalation(
    id: str,
    comments: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(allow_clinician)
):
    query = select(ClinicianEscalation).where(ClinicianEscalation.id == id)
    res = await db.execute(query)
    escalation = res.scalars().first()
    
    if not escalation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Escalation not found."
        )
        
    import datetime
    escalation.status = "resolved"
    escalation.resolved_at = datetime.datetime.utcnow()
    escalation.comments = comments
    
    await db.commit()
    return {"message": "Escalation resolved successfully."}

@router.post("/patient-history")
async def get_patient_history_by_otp(
    payload: ClinicianAccessHistoryRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(allow_clinician)
):
    # Find patient by email
    query = select(Patient).where(Patient.email == payload.patient_email)
    result = await db.execute(query)
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found with the specified email address."
        )

    # Check OTP in Redis
    if not redis_manager.client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Redis server offline."
        )

    cached_patient_id = await redis_manager.client.get(f"patient_access_otp:{payload.otp_code}")
    if not cached_patient_id or cached_patient_id != str(patient.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired patient access OTP."
        )

    # Consume OTP immediately for privacy/security reasons (Single-use OTP)
    await redis_manager.client.delete(f"patient_access_otp:{payload.otp_code}")

    # Fetch medical history records
    vitals_q = select(Vital).where(Vital.patient_id == patient.id).order_by(Vital.recorded_at.desc())
    reports_q = select(Report).where(Report.patient_id == patient.id).order_by(Report.created_at.desc())
    histories_q = select(PatientHistory).where(PatientHistory.patient_id == patient.id).order_by(PatientHistory.created_at.desc())
    profile_q = select(PatientProfile).where(PatientProfile.patient_id == patient.id)

    v_res = await db.execute(vitals_q)
    r_res = await db.execute(reports_q)
    h_res = await db.execute(histories_q)
    p_res = await db.execute(profile_q)

    vitals = v_res.scalars().all()
    reports = r_res.scalars().all()
    histories = h_res.scalars().all()
    profile = p_res.scalars().first()

    profile_dict = {}
    if profile:
        profile_dict = {
            "age": profile.age,
            "gender": profile.gender,
            "race": profile.race,
            "height": profile.height,
            "weight": profile.weight,
            "fasting_blood_glucose": profile.fasting_blood_glucose,
            "active_medications": profile.active_medications or [],
            "allergies": profile.allergies or [],
            "lifestyle_smoke": profile.lifestyle_smoke,
            "lifestyle_active": profile.lifestyle_active,
            "alcohol_consumption": profile.alcohol_consumption,
            "sleep_duration": profile.sleep_duration,
            "sleep_quality": profile.sleep_quality,
            "tobacco_consumption": profile.tobacco_consumption,
            "past_operations": profile.past_operations or [],
            "medical_history": profile.medical_history or [],
            "additional_notes": profile.additional_notes
        }

    return {
        "patient_id": str(patient.id),
        "email": patient.email,
        "profile": profile_dict,
        "vitals": [
            {
                "id": str(v.id),
                "systolic_bp": v.systolic_bp,
                "diastolic_bp": v.diastolic_bp,
                "blood_sugar": v.blood_sugar,
                "blood_sugar_type": v.blood_sugar_type,
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
                "extracted_values": rep.extracted_values,
                "raw_model_notes": rep.raw_model_notes,
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

@router.post("/patient-history/update")
async def update_patient_history_by_otp(
    payload: ClinicianUpdateHistoryRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(allow_clinician)
):
    # Find patient by email
    query = select(Patient).where(Patient.email == payload.patient_email)
    result = await db.execute(query)
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found with the specified email address."
        )

    # Check OTP in Redis
    if not redis_manager.client:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Redis server offline."
        )

    cached_patient_id = await redis_manager.client.get(f"patient_access_otp:{payload.otp_code}")
    if not cached_patient_id or cached_patient_id != str(patient.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or expired patient access OTP."
        )

    # Consume OTP immediately
    await redis_manager.client.delete(f"patient_access_otp:{payload.otp_code}")

    # Retrieve patient profile
    profile_query = select(PatientProfile).where(PatientProfile.patient_id == patient.id)
    profile_res = await db.execute(profile_query)
    profile = profile_res.scalars().first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile does not exist yet."
        )

    # Perform updates
    changes = []
    if payload.active_medications is not None:
        old_meds = profile.active_medications or []
        profile.active_medications = payload.active_medications
        changes.append(f"medications updated from {old_meds} to {payload.active_medications}")
        
    if payload.past_operations is not None:
        old_ops = profile.past_operations or []
        profile.past_operations = payload.past_operations
        changes.append(f"operations updated from {old_ops} to {payload.past_operations}")

    if changes:
        import datetime
        profile.updated_at = datetime.datetime.utcnow()
        await db.commit()
        await db.refresh(profile)

        # Log audit entry to Kafka
        from app.db.kafka import kafka_manager
        if kafka_manager.producer:
            audit_message = {
                "event": "clinician_update_profile",
                "patient_id": str(patient.id),
                "clinician_email": current_user.email,
                "changes": changes,
                "timestamp": datetime.datetime.utcnow().isoformat()
            }
            await kafka_manager.producer.send_and_wait("audit_log", audit_message)

    return {"message": "Patient records updated successfully.", "updated_fields": changes}

@router.get("/emergencies", response_model=List[EmergencyResponse])
async def get_emergencies(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius_km: Optional[float] = 50.0,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(allow_clinician)
):
    import math
    
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371.0  # Earth radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c

    query = select(EmergencyAlert).where(EmergencyAlert.status == "pending")
    res = await db.execute(query)
    alerts = res.scalars().all()
    
    alerts_list = list(alerts)
    
    # Priority: 1. Passed query params -> 2. Clinician's registered account coordinates
    target_lat = latitude if latitude is not None else getattr(current_user, "latitude", None)
    target_lon = longitude if longitude is not None else getattr(current_user, "longitude", None)
    
    filtered_alerts = []
    if target_lat is not None and target_lon is not None:
        for alert in alerts_list:
            dist = haversine(target_lat, target_lon, alert.latitude, alert.longitude)
            alert.distance_km = dist
            # Only include alerts within proximity radius
            if radius_km is None or dist <= radius_km:
                filtered_alerts.append(alert)
        filtered_alerts.sort(key=lambda x: getattr(x, "distance_km", 0.0))
    else:
        filtered_alerts = alerts_list
        filtered_alerts.sort(key=lambda x: x.created_at, reverse=True)
        
    return filtered_alerts

@router.post("/emergencies/{id}/accept", response_model=EmergencyResponse)
async def accept_emergency(
    id: str,
    payload: Optional[EmergencyAcceptPayload] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(allow_clinician)
):
    import datetime
    import uuid
    
    query = select(EmergencyAlert).where(EmergencyAlert.id == uuid.UUID(id))
    res = await db.execute(query)
    alert = res.scalars().first()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Emergency alert not found."
        )
        
    if alert.status == "accepted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Emergency alert has already been accepted by another hospital."
        )
        
    # Resolve facility name and phone: Payload -> Clinician User Profile -> Fallback Email
    hosp_name = (payload.hospital_name if payload and payload.hospital_name else None) or getattr(current_user, "facility_name", None) or f"Hospital ({current_user.email})"
    hosp_phone = (payload.phone if payload and payload.phone else None) or getattr(current_user, "phone", None) or "Direct Dispatch Line"

    alert.status = "accepted"
    alert.accepted_by_hospital = hosp_name
    alert.accepted_by_phone = hosp_phone
    alert.accepted_at = datetime.datetime.utcnow()
    
    await db.commit()
    await db.refresh(alert)
    
    # Write audit log to Kafka
    from app.db.kafka import kafka_manager
    if kafka_manager.producer:
        audit_message = {
            "event": "emergency_accepted",
            "emergency_id": str(alert.id),
            "patient_id": str(alert.patient_id),
            "clinician_email": current_user.email,
            "accepted_by_hospital": hosp_name,
            "accepted_by_phone": hosp_phone,
            "timestamp": alert.accepted_at.isoformat()
        }
        await kafka_manager.producer.send_and_wait("audit_log", audit_message)
        
    return alert

