from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.db.redis import redis_manager
from app.models.all_models import Patient, PatientProfile, Vital, Report, PatientHistory
from app.models.schemas import PatientProfileCreate, PatientProfileResponse, VitalCreate, VitalResponse
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

@router.get("/{id}/profile", response_model=PatientProfileResponse)
async def get_profile(
    id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Patient = Depends(allow_any)
):
    verify_self_or_clinician(id, current_user)
    
    query = select(PatientProfile).where(PatientProfile.patient_id == id)
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

    query = select(PatientProfile).where(PatientProfile.patient_id == id)
    res = await db.execute(query)
    profile = res.scalars().first()

    if profile:
        # Update existing profile
        for key, value in payload.model_dump().items():
            setattr(profile, key, value)
    else:
        # Create new profile
        profile = PatientProfile(
            patient_id=id,
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
        patient_id=id,
        **payload.model_dump(exclude_unset=True)
    )
    db.add(new_vital)
    await db.commit()
    await db.refresh(new_vital)

    # Invalidate Redis warm cache of vitals for this patient
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
    vitals_q = select(Vital).where(Vital.patient_id == id).order_by(Vital.recorded_at.desc())
    reports_q = select(Report).where(Report.patient_id == id).order_by(Report.created_at.desc())
    histories_q = select(PatientHistory).where(PatientHistory.patient_id == id).order_by(PatientHistory.created_at.desc())

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
    profile_query = select(PatientProfile).where(PatientProfile.patient_id == id)
    profile_res = await db.execute(profile_query)
    profile = profile_res.scalars().first()
    
    # Load latest vitals
    vitals_query = select(Vital).where(Vital.patient_id == id).order_by(Vital.recorded_at.desc()).limit(1)
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
            "active_medications": profile.active_medications or [],
            "allergies": profile.allergies or [],
            "lifestyle_smoke": profile.lifestyle_smoke,
            "lifestyle_active": profile.lifestyle_active,
            "family_history_cardiovascular": profile.family_history_cardiovascular,
            "family_history_diabetes": profile.family_history_diabetes,
            "sleep_duration": profile.sleep_duration,
            "sleep_quality": profile.sleep_quality,
            "alcohol_consumption": profile.alcohol_consumption,
            "tobacco_consumption": profile.tobacco_consumption
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

