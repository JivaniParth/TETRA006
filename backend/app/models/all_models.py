import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from app.db.postgres import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="patient")  # "patient" or "clinician"
    facility_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), unique=True, nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String, nullable=False)
    race = Column(String, nullable=False)
    height = Column(Float, nullable=False)  # in cm
    weight = Column(Float, nullable=False)  # in kg
    systolic_bp = Column(Integer, nullable=False)  # baseline
    diastolic_bp = Column(Integer, nullable=False)  # baseline
    fasting_blood_glucose = Column(Float, nullable=False)  # baseline mg/dL
    family_history_cardiovascular = Column(Boolean, default=False)
    family_history_diabetes = Column(Boolean, default=False)
    active_medications = Column(JSON, default=list)  # list of strings
    allergies = Column(JSON, default=list)  # list of strings
    
    # Lifestyle details
    lifestyle_smoke = Column(Boolean, default=False)
    lifestyle_active = Column(Boolean, default=False)
    alcohol_consumption = Column(String, default="none")  # "none", "occasional", "moderate", "heavy"
    sleep_duration = Column(Float, default=7.0)  # hours per night
    sleep_quality = Column(String, default="good")  # "poor", "average", "good"
    tobacco_consumption = Column(String, default="none")  # "none", "past", "daily"
    
    # History details
    past_operations = Column(JSON, default=list)  # list of strings
    medical_history = Column(JSON, default=list)  # list of strings
    additional_notes = Column(String, nullable=True)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Vital(Base):
    __tablename__ = "vitals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    systolic_bp = Column(Integer, nullable=True)
    diastolic_bp = Column(Integer, nullable=True)
    blood_sugar = Column(Float, nullable=True)
    blood_sugar_type = Column(String, nullable=True, default="random")
    creatinine = Column(Float, nullable=True)
    heart_rate = Column(Integer, nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow)

class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # "pdf", "image"
    extracted_values = Column(JSON, default=dict)  # extracted vitals and lab values
    raw_model_notes = Column(String, nullable=True)
    confidence = Column(Float, nullable=False, default=0.0)
    range_check_passed = Column(Boolean, nullable=False, default=False)
    status = Column(String, nullable=False, default="pending_confirmation")  # "auto_saved", "pending_confirmation", "confirmed", "corrected"
    severity_tier = Column(String, nullable=False, default="can_ignore")  # "critical", "important", "can_ignore"
    created_at = Column(DateTime, default=datetime.utcnow)

class ClinicianEscalation(Base):
    __tablename__ = "clinician_escalations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    query_id = Column(String, nullable=True)
    reason = Column(String, nullable=False)
    severity_tier = Column(String, nullable=False, default="important")  # "critical", "important"
    status = Column(String, nullable=False, default="pending")  # "pending", "resolved"
    resolved_at = Column(DateTime, nullable=True)
    comments = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class PatientHistory(Base):
    """Warm history storage with pgvector"""
    __tablename__ = "patient_histories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    content_type = Column(String, nullable=False)  # "query_response", "vital_log", "report_summary"
    text_content = Column(String, nullable=False)
    embedding = Column(Vector(768), nullable=False)  # 768-dimensional vector for Gemini embeddings
    created_at = Column(DateTime, default=datetime.utcnow)

class EmergencyAlert(Base):
    __tablename__ = "emergency_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    patient_email = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    status = Column(String, nullable=False, default="pending")  # "pending", "accepted"
    accepted_by_hospital = Column(String, nullable=True)
    accepted_by_phone = Column(String, nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True)  # session_id e.g. user_..._ts_...
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False, default="Medical Consultation")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(String, nullable=False)
    html_content = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

