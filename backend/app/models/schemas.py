from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, EmailStr, Field

# Authentication
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: str = Field("patient", pattern="^(patient|clinician)$")

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
    systolic_bp: int = Field(..., ge=40, le=300)
    diastolic_bp: int = Field(..., ge=30, le=200)
    fasting_blood_glucose: float = Field(..., ge=20, le=1000) # mg/dL
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
    creatinine: Optional[float] = Field(None, ge=0.1, le=30.0)
    heart_rate: Optional[int] = Field(None, ge=30, le=250)

class VitalResponse(VitalCreate):
    id: Any
    patient_id: Any
    recorded_at: datetime

    class Config:
        from_attributes = True

# Clinical Queries
class QueryRequest(BaseModel):
    text: str = Field(..., min_length=1)
    session_id: Optional[str] = None

class QueryResponse(BaseModel):
    session_id: str
    response: str
    status: str  # "awaiting_user_input" or "complete"
    pending_fields: List[str]
    safety_alerts: List[str]

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
