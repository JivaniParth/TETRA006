from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, EmailStr, Field

# Authentication
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: str = Field("patient", pattern="^(patient|clinician)$")
    facility_name: Optional[str] = None
    phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    role: str


# Patient Profile
class PatientProfileCreate(BaseModel):
    age: int = Field(..., ge=0, le=120)
    gender: str = Field(..., pattern="^(male|female|other)$")
    race: str
    height: float = Field(..., ge=30, le=250)  # cm
    weight: float = Field(..., ge=2, le=500)   # kg
    systolic_bp: int = Field(120, ge=40, le=300)
    diastolic_bp: int = Field(80, ge=30, le=200)
    fasting_blood_glucose: float = Field(90.0, ge=20, le=1000) # mg/dL
    family_history_cardiovascular: bool = False
    family_history_diabetes: bool = False
    active_medications: List[str] = Field(default_factory=list)
    allergies: List[str] = Field(default_factory=list)
    
    # Lifestyle parameters
    lifestyle_smoke: bool = False
    lifestyle_active: bool = False
    alcohol_consumption: str = Field("none", pattern="^(none|occasional|moderate|heavy)$")
    sleep_duration: float = Field(7.0, ge=0.0, le=24.0)
    sleep_quality: str = Field("good", pattern="^(poor|average|good)$")
    tobacco_consumption: str = Field("none", pattern="^(none|past|daily)$")
    
    # Past medical context
    past_operations: List[str] = Field(default_factory=list)
    medical_history: List[str] = Field(default_factory=list)
    additional_notes: Optional[str] = None

class PatientProfileResponse(PatientProfileCreate):
    id: Any
    patient_id: Any
    updated_at: datetime

    class Config:
        from_attributes = True

# Vitals
class VitalCreate(BaseModel):
    systolic_bp: Optional[int] = Field(None, ge=40, le=300)
    diastolic_bp: Optional[int] = Field(None, ge=30, le=200)
    blood_sugar: Optional[float] = Field(None, ge=20, le=1000)
    blood_sugar_type: Optional[str] = Field("random", pattern="^(fasting|random|post_prandial)$")
    creatinine: Optional[float] = Field(None, ge=0.1, le=30.0)
    heart_rate: Optional[int] = Field(None, ge=30, le=250)
    weight: Optional[float] = Field(None, ge=1.0, le=500.0)
    water_intake_ml: Optional[int] = Field(None, ge=0, le=20000)
    sleep_hours: Optional[float] = Field(None, ge=0.0, le=24.0)

class VitalResponse(VitalCreate):
    id: Any
    patient_id: Any
    recorded_at: datetime

    class Config:
        from_attributes = True

# OTP History Access Definitions
class ClinicianAccessHistoryRequest(BaseModel):
    patient_email: EmailStr
    otp_code: str = Field(..., pattern="^\\d{6}$")

class ClinicianUpdateHistoryRequest(BaseModel):
    patient_email: EmailStr
    otp_code: str = Field(..., pattern="^\\d{6}$")
    active_medications: Optional[List[str]] = None
    past_operations: Optional[List[str]] = None

class OtpGenerateResponse(BaseModel):
    otp_code: str
    expires_in_seconds: int = 60


# Clinical Queries
class QueryRequest(BaseModel):
    text: str = Field(..., min_length=1)
    session_id: Optional[str] = None

class QueryResponse(BaseModel):
    session_id: str
    response: str
    html_response: Optional[str] = None
    english_response: Optional[str] = None
    detected_language: Optional[str] = "en"
    status: str  # "awaiting_user_input" or "complete"
    pending_fields: List[str]
    safety_alerts: List[str]

class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1)
    voice_id: Optional[str] = None

# Reports
class ReportExtractionResponse(BaseModel):
    report_id: Any
    file_name: str
    extracted_values: Dict[str, Any]
    confidence: float
    range_check_passed: bool
    status: str
    severity_tier: str

class ReportConfirmRequest(BaseModel):
    corrected_values: Optional[Dict[str, Any]] = None
    confirm: bool = True

# Clinician Escalations
class EscalationResponse(BaseModel):
    id: Any
    patient_id: Any
    query_id: Optional[str]
    reason: str
    severity_tier: str
    status: str
    resolved_at: Optional[datetime]
    comments: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# Emergency Alerts
class EmergencyCreate(BaseModel):
    latitude: float
    longitude: float

class EmergencyAcceptPayload(BaseModel):
    hospital_name: Optional[str] = None
    phone: Optional[str] = None

class EmergencyResponse(BaseModel):
    id: Any
    patient_id: Any
    patient_email: str
    latitude: float
    longitude: float
    status: str
    accepted_by_hospital: Optional[str]
    accepted_by_phone: Optional[str]
    accepted_at: Optional[datetime]
    created_at: datetime
    distance_km: Optional[float] = None

    class Config:
        from_attributes = True
