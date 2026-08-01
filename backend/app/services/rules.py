import re
from typing import Dict, Any, List

def fallback_classify(text: str) -> Dict[str, Any]:
    text_lower = text.lower()
    
    # 1. Classify Urgency
    urgent_keywords = [
        "chest pain", "shortness of breath", "difficulty breathing", "crushing pressure",
        "crushing pain", "sudden numbness", "sudden weakness", "facial drooping",
        "slurred speech", "severe pressure", "bleeding", "unconscious", "fainted",
        "excruciating", "worst headache", "vision loss", "paralysis"
    ]
    
    urgency = "routine"
    urgency_score = 0.1
    for keyword in urgent_keywords:
        if keyword in text_lower:
            urgency = "urgent"
            urgency_score = 0.95
            break
            
    if "severe" in text_lower or "intense" in text_lower:
        urgency_score = max(urgency_score, 0.6)
        if urgency_score >= 0.6:
            urgency = "urgent"

    # 2. Classify Query Type
    query_types = []
    if any(k in text_lower for k in ["symptom", "pain", "hurt", "feel", "ache", "cough", "fever"]):
        query_types.append("symptom_check")
    if any(k in text_lower for k in ["medication", "pill", "drug", "dose", "tablet", "aspirin", "insulin", "side effect"]):
        query_types.append("medication_info")
    if any(k in text_lower for k in ["report", "lab", "result", "pdf", "scan", "test", "glucose level", "blood pressure"]):
        query_types.append("report_query")
        
    if not query_types:
        query_types.append("general")

    # 3. Detect Body Part
    body_parts = {
        "chest": ["chest", "heart", "breath", "lung", "cardiac", "rib"],
        "head": ["head", "brain", "migraine", "headache", "neck", "eye", "ear", "nose", "throat"],
        "abdomen": ["stomach", "abdomen", "belly", "gut", "nausea", "vomit", "liver", "kidney", "appendix"],
        "limbs": ["arm", "leg", "foot", "hand", "finger", "toe", "knee", "elbow", "joint", "muscle"],
        "skin": ["skin", "rash", "itch", "dermatitis", "burn", "wound"],
    }
    
    detected_body_part = None
    for part, keywords in body_parts.items():
        if any(k in text_lower for k in keywords):
            detected_body_part = part
            break

    # 4. Parse Duration
    duration_patterns = [
        r"(\d+\s*(?:hour|hr|day|week|wk|month|mon|year|yr)s?)",
        r"(since\s+\w+)",
        r"(yesterday|today|tonight|now|morning|afternoon|evening|night)",
        r"(\d+\s*-\s*\d+\s*(?:days|hours|weeks))",
        r"(for\s+a\s+while|long\s+time|few\s+days)",
        r"(\d+\s*(?:minute|min)s?\s*(?:ago)?)"
    ]

    
    detected_duration = None
    for pattern in duration_patterns:
        match = re.search(pattern, text_lower)
        if match:
            detected_duration = match.group(1)
            break

    # 5. Check Missing Critical Fields
    missing_fields = []
    if not detected_body_part:
        missing_fields.append("body_part")
    if not detected_duration:
        missing_fields.append("duration")

    return {
        "urgency": urgency,
        "urgency_score": urgency_score,
        "query_type": query_types,
        "body_part": detected_body_part,
        "duration": detected_duration,
        "missing_fields": missing_fields
    }
