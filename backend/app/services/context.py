import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# Token/Character Budget Proxy: 16000 characters (~4000 tokens)
MAX_CHAR_BUDGET = 16000

class ContextAssembler:
    def assemble_medgemma_prompt(
        self,
        query_text: str,
        classification: Dict[str, Any],
        profile_dict: Dict[str, Any],
        safety_output: Dict[str, Any],
        retrieved_context: Dict[str, Any],
        session_history: List[Dict[str, str]] = None
    ) -> str:
        """
        Assembles and optimizes context for the MedGemma LLM.
        Applies dynamic tier reweighting and enforces character/token budgets.
        """
        # 1. Classify the query intent for dynamic reweighting
        query_lower = query_text.lower()
        is_cardiac = any(k in query_lower for k in ["chest", "heart", "breath", "bp", "cardiovascular", "pressure", "stroke"])
        is_diabetic = any(k in query_lower for k in ["sugar", "glucose", "diabetes", "diabetic", "dizzy", "insulin"])
        is_renal = any(k in query_lower for k in ["creatinine", "kidney", "renal", "egfr", "urine"])
        is_med_allergy = any(k in query_lower for k in ["allergy", "medication", "pill", "side effect", "drug", "interaction"])

        # 2. Extract retrieved logs and reports
        hot_vitals = retrieved_context.get("hot_vitals", [])
        vitals_warm = retrieved_context.get("vitals_warm", [])
        reports_warm = retrieved_context.get("reports_warm", [])
        semantic_hits = retrieved_context.get("semantic_history", [])

        # Categorize retrieved history into tiers
        critical_items = []
        important_items = []
        can_ignore_items = []

        # Reweight and tier vitals
        for v in hot_vitals + vitals_warm:
            text = (
                f"Vital Log ({v.get('recorded_at') or 'recent'}): "
                f"BP={v.get('systolic_bp') or 'N/A'}/{v.get('diastolic_bp') or 'N/A'} mmHg, "
                f"Glucose={v.get('blood_sugar') or 'N/A'} mg/dL, HR={v.get('heart_rate') or 'N/A'} bpm, "
                f"Creatinine={v.get('creatinine') or 'N/A'} mg/dL."
            )
            
            # Dynamic reweighting rules
            sys_bp = v.get("systolic_bp")
            dia = v.get("diastolic_bp")
            glucose = v.get("blood_sugar")
            
            is_bp_critical = sys_bp is not None and (sys_bp > 160 or sys_bp < 95)
            is_glucose_critical = glucose is not None and (glucose > 200 or glucose < 65)

            if (is_cardiac and (sys_bp is not None or dia is not None)) or is_bp_critical:
                critical_items.append(text)
            elif (is_diabetic and glucose is not None) or is_glucose_critical:
                critical_items.append(text)
            elif is_renal and v.get("creatinine") is not None:
                critical_items.append(text)
            elif sys_bp is not None or glucose is not None:
                important_items.append(text)
            else:
                can_ignore_items.append(text)

        # Reweight and tier reports
        for r in reports_warm:
            text = (
                f"Warm Report ({r.get('created_at')} - {r.get('file_name')}): "
                f"Extracted values={r.get('extracted_values')}, "
                f"Severity Tier={r.get('severity_tier')}, Status={r.get('status')}."
            )
            tier = r.get("severity_tier", "can_ignore")
            
            # Dynamic upgrades
            if is_cardiac and any(k in str(r.get("extracted_values")).lower() for k in ["bp", "systolic", "diastolic", "pressure"]):
                critical_items.append(text)
            elif is_diabetic and any(k in str(r.get("extracted_values")).lower() for k in ["glucose", "sugar"]):
                critical_items.append(text)
            elif tier == "critical":
                critical_items.append(text)
            elif tier == "important":
                important_items.append(text)
            else:
                can_ignore_items.append(text)

        # Reweight and tier semantic search hits
        for sh in semantic_hits:
            payload = sh.get("payload", {})
            text = f"Semantic History Match (Score {sh.get('score', 0):.2f}): {payload.get('text')}"
            sev = payload.get("severity_tier", "can_ignore")
            
            if is_cardiac and any(k in text.lower() for k in ["chest", "heart", "breath", "pressure"]):
                critical_items.append(text)
            elif is_diabetic and any(k in text.lower() for k in ["sugar", "glucose", "diabetes"]):
                critical_items.append(text)
            elif sev == "critical":
                critical_items.append(text)
            elif sev == "important":
                important_items.append(text)
            else:
                can_ignore_items.append(text)

        # 3. Assemble components in order of absolute preservation
        # Safety output, user query, patient profile, and critical items are preserved first.
        
        # Build Profile block
        profile_block = (
            "=== PATIENT BASELINE PROFILE ===\n"
            f"Age: {profile_dict.get('age')} years, Gender: {profile_dict.get('gender')}, Race: {profile_dict.get('race')}\n"
            f"Height: {profile_dict.get('height')} cm, Weight: {profile_dict.get('weight')} kg\n"
            f"Active Medications: {', '.join(profile_dict.get('active_medications', [])) or 'None'}\n"
            f"Known Allergies: {', '.join(profile_dict.get('allergies', [])) or 'None'}\n"
            f"Lifestyle: Smoke={profile_dict.get('lifestyle_smoke')}, Active={profile_dict.get('lifestyle_active')}, "
            f"Alcohol={profile_dict.get('alcohol_consumption')}, Sleep={profile_dict.get('sleep_duration')}h ({profile_dict.get('sleep_quality')})\n"
            f"Medical History: {', '.join(profile_dict.get('medical_history', [])) or 'None'}\n"
            f"Past Operations: {', '.join(profile_dict.get('past_operations', [])) or 'None'}\n"
        )

        # Build Safety Layer block
        safety_block = (
            "=== DETERMINISTIC CLINICAL SAFETY CHECKS ===\n"
            f"10-Year ASCVD Risk Score: {safety_output['ascvd_risk'].get('score') or 'N/A'}% ({safety_output['ascvd_risk'].get('category') or 'unknown'})\n"
            f"FINDRISC Diabetes Score: {safety_output['diabetes_risk'].get('score') or 'N/A'} ({safety_output['diabetes_risk'].get('category') or 'unknown'})\n"
            f"Kidney Function (CKD-EPI GFR): {safety_output['kidney_gfr'].get('egfr') or 'N/A'} mL/min/1.73m2 ({safety_output['kidney_gfr'].get('stage') or 'unknown'})\n"
            f"Blood Pressure Staging: {safety_output['blood_pressure_stage'].get('stage') or 'N/A'} (Values: {safety_output['blood_pressure_stage'].get('systolic') or 'N/A'}/{safety_output['blood_pressure_stage'].get('diastolic') or 'N/A'} mmHg)\n"
        )
        
        if safety_output.get("medication_allergy_warnings"):
            safety_block += "Medication/Allergy Interaction Warnings:\n"
            for warning in safety_output["medication_allergy_warnings"]:
                safety_block += f" - {warning}\n"

        # Build query/classification block
        query_block = (
            "=== CURRENT PATIENT QUERY ===\n"
            f"Query: \"{query_text}\"\n"
            f"Classifier Assessment: Urgency={classification.get('urgency', 'routine')}, "
            f"Query Types={classification.get('query_type')}, Body Part={classification.get('body_part')}, "
            f"Duration={classification.get('duration')}\n"
        )

        # Calculate character consumption so far
        fixed_content = profile_block + safety_block + query_block
        current_len = len(fixed_content)

        # 4. Add retrieved elements under budget restrictions
        history_header = "=== RELEVANT HISTORICAL CONTEXT ===\n"
        history_block = ""
        
        budget_remaining = MAX_CHAR_BUDGET - current_len - len(history_header)

        # Truncation order: can_ignore first, then important, keeping critical.
        # So we assemble history by keeping:
        # 1. Critical items
        # 2. Important items
        # 3. Can ignore items
        
        # We will add critical items up to remaining budget
        added_critical = []
        for item in critical_items:
            item_str = f"[CRITICAL] {item}\n"
            if len(item_str) <= budget_remaining:
                added_critical.append(item_str)
                budget_remaining -= len(item_str)
            else:
                break
                
        # We will add important items up to remaining budget
        added_important = []
        for item in important_items:
            item_str = f"[IMPORTANT] {item}\n"
            if len(item_str) <= budget_remaining:
                added_important.append(item_str)
                budget_remaining -= len(item_str)
            else:
                break
                
        # We will add can_ignore items up to remaining budget
        added_ignore = []
        for item in can_ignore_items:
            item_str = f"[INFO] {item}\n"
            if len(item_str) <= budget_remaining:
                added_ignore.append(item_str)
                budget_remaining -= len(item_str)
            else:
                break

        # Build session conversation history block if available
        session_dialogue_block = ""
        if session_history and len(session_history) > 1:
            session_dialogue_block = "=== PRIOR SESSION DIALOGUE HISTORY ===\n"
            for msg in session_history[:-1]:  # exclude latest user turn which is query_text
                session_dialogue_block += f"{msg.get('role', 'user').upper()}: {msg.get('content')}\n"
            session_dialogue_block += "\n"

        history_block = "".join(added_critical + added_important + added_ignore)
        
        final_prompt = (
            "You are MedGemma, a compassionate clinical assistant talking directly to the patient. "
            "Address the patient directly, answering their questions in a supportive, reassuring, and clear tone. "
            "DO NOT scare the patient or cause unnecessary panic. Be comforting but clinically accurate. "
            "Review the clinical files, safety calculators, and patient history below. "
            "CRITICAL CONCISENESS DIRECTIVE: Keep your response extremely brief, direct, and focused strictly on key important points. "
            "Do NOT write long wordy intros, repetitive explanations, or filler text. Limit your entire response to at most 100-150 words using 3 bulleted sections:\n"
            "1. Assessment (1-2 direct comforting sentences explaining what is happening)\n"
            "2. Key Actions & Advice (Max 3 bullet points of simple, actionable steps they can take)\n"
            "3. Safety Alerts & Cautions (Important red flags to watch out for)\n"
            "You must NOT override the deterministic safety checks or interaction warnings. Highlight safety checks in your response. "
            "You must include this brief clinical disclaimer at the end: "
            "\"Disclaimer: This AI system is for decision support and does not replace a formal medical diagnosis. Please consult a healthcare provider.\"\n\n"
            f"{profile_block}\n"
            f"{safety_block}\n"
            f"{session_dialogue_block}"
            f"{history_header}{history_block}\n"
            f"{query_block}\n"
            "Response:"
        )
        
        return final_prompt

context_assembler = ContextAssembler()
