import math
import logging
from typing import Dict, Any, List, Tuple, Optional

logger = logging.getLogger(__name__)

# ASCVD Coefficients (Pooled Cohort Equations)
# Order: ln(Age), ln(Age)^2, ln(Total Cholesterol), ln(Age)*ln(Total Cholesterol), ln(HDL), ln(Age)*ln(HDL), ln(Systolic BP), ln(Age)*ln(Systolic BP), Smoker, ln(Age)*Smoker, Diabetes
# Baseline Survival (S_avg) and Mean Coefficient Sum (Mean_Beta_X)
ASCVD_COEFFS = {
    "white_female": {
        "ln_age": -29.799, "ln_age_sq": 4.884, "ln_tot_chol": 13.540, "ln_age_tot_chol": -3.114,
        "ln_hdl": -13.578, "ln_age_hdl": 3.149, "ln_sys_bp_treated": 2.019, "ln_age_sys_bp_treated": 0.0,
        "ln_sys_bp_untreated": 1.957, "ln_age_sys_bp_untreated": 0.0, "smoker": 7.574, "ln_age_smoker": -1.665,
        "diabetes": 0.661, "s_avg": 0.9665, "mean_beta": -29.18
    },
    "black_female": {
        "ln_age": 17.114, "ln_age_sq": 0.0, "ln_tot_chol": 0.940, "ln_age_tot_chol": 0.0,
        "ln_hdl": -18.920, "ln_age_hdl": 4.475, "ln_sys_bp_treated": 29.291, "ln_age_sys_bp_treated": -6.432,
        "ln_sys_bp_untreated": 27.820, "ln_age_sys_bp_untreated": -6.087, "smoker": 0.691, "ln_age_smoker": 0.0,
        "diabetes": 0.874, "s_avg": 0.9533, "mean_beta": 86.61
    },
    "white_male": {
        "ln_age": 12.344, "ln_age_sq": 0.0, "ln_tot_chol": 11.853, "ln_age_tot_chol": -2.664,
        "ln_hdl": -7.990, "ln_age_hdl": 1.769, "ln_sys_bp_treated": 1.797, "ln_age_sys_bp_treated": 0.0,
        "ln_sys_bp_untreated": 1.764, "ln_age_sys_bp_untreated": 0.0, "smoker": 7.837, "ln_age_smoker": -1.795,
        "diabetes": 0.658, "s_avg": 0.9144, "mean_beta": 61.18
    },
    "black_male": {
        "ln_age": 2.469, "ln_age_sq": 0.0, "ln_tot_chol": 0.302, "ln_age_tot_chol": 0.0,
        "ln_hdl": -2.307, "ln_age_hdl": 0.0, "ln_sys_bp_treated": 1.916, "ln_age_sys_bp_treated": 0.0,
        "ln_sys_bp_untreated": 1.809, "ln_age_sys_bp_untreated": 0.0, "smoker": 0.549, "ln_age_smoker": 0.0,
        "diabetes": 0.645, "s_avg": 0.8954, "mean_beta": 19.54
    }
}

# Medication & Allergy Interactions Database
DRUG_INTERACTIONS = {
    ("warfarin", "aspirin"): "High risk of bleeding. Concomitant use increases bleeding tendency.",
    ("ibuprofen", "aspirin"): "NSAID interaction. Ibuprofen may decrease the cardioprotective effect of low-dose aspirin.",
    ("lisinopril", "potassium"): "Risk of hyperkalemia. Lisinopril reduces potassium excretion, raising potassium to dangerous levels.",
    ("spironolactone", "lisinopril"): "Risk of hyperkalemia. Both medications conserve potassium, increasing risk of arrhythmia.",
    ("sildenafil", "nitroglycerin"): "Contraindicated. Coadministration can lead to severe, life-threatening hypotension.",
    ("metformin", "contrast dye"): "Risk of lactic acidosis. Metformin should be held prior to and after radiological exams using iodinated contrast."
}

ALLERGY_GROUPS = {
    "penicillin": ["amoxicillin", "penicillin", "ampicillin", "piperacillin", "augmentin", "cephalexin", "cefdinir"],
    "sulfa": ["sulfamethoxazole", "bactrim", "septra", "sulfasalazine", "dapsone"],
    "aspirin": ["aspirin", "ibuprofen", "naproxen", "advil", "aleve", "diclofenac", "meloxicam", "celecoxib"]
}

def calculate_ascvd(profile: Dict[str, Any]) -> Dict[str, Any]:
    """Calculates 10-year risk of cardiovascular event using Pooled Cohort Equations"""
    try:
        age = profile.get("age")
        gender = profile.get("gender")
        race_raw = profile.get("race", "").lower()
        
        # We need total cholesterol and HDL. If missing from profile, check if vitals have them, or use averages.
        # However, for clinical safety, if these parameters are missing, we should flag that we cannot calculate.
        # We assume they might be in the profile or vitals.
        tot_chol = profile.get("total_cholesterol", 200.0) # standard average placeholder
        hdl = profile.get("hdl_cholesterol", 50.0)
        sys_bp = profile.get("systolic_bp")
        treated = profile.get("bp_treated", False)
        smoker = profile.get("lifestyle_smoke", False)
        diabetes = profile.get("family_history_diabetes", False) or (profile.get("fasting_blood_glucose", 0) > 126.0)

        # Race classification
        race = "white"
        if "black" in race_raw or "african" in race_raw:
            race = "black"
            
        group = f"{race}_{gender}"
        if group not in ASCVD_COEFFS:
            # fallback to white_male or white_female depending on gender
            group = f"white_{gender}" if gender in ["male", "female"] else "white_male"
            
        coeffs = ASCVD_COEFFS[group]
        
        # Calculate terms
        ln_age = math.log(age)
        ln_tot_chol = math.log(tot_chol)
        ln_hdl = math.log(hdl)
        ln_sys_bp = math.log(sys_bp)
        
        sum_beta_x = 0.0
        sum_beta_x += coeffs["ln_age"] * ln_age
        if coeffs["ln_age_sq"] != 0:
            sum_beta_x += coeffs["ln_age_sq"] * (ln_age ** 2)
            
        sum_beta_x += coeffs["ln_tot_chol"] * ln_tot_chol
        if coeffs["ln_age_tot_chol"] != 0:
            sum_beta_x += coeffs["ln_age_tot_chol"] * (ln_age * ln_tot_chol)
            
        sum_beta_x += coeffs["ln_hdl"] * ln_hdl
        if coeffs["ln_age_hdl"] != 0:
            sum_beta_x += coeffs["ln_age_hdl"] * (ln_age * ln_hdl)
            
        if treated:
            sum_beta_x += coeffs["ln_sys_bp_treated"] * ln_sys_bp
            if coeffs["ln_age_sys_bp_treated"] != 0:
                sum_beta_x += coeffs["ln_age_sys_bp_treated"] * (ln_age * ln_sys_bp)
        else:
            sum_beta_x += coeffs["ln_sys_bp_untreated"] * ln_sys_bp
            if coeffs["ln_age_sys_bp_untreated"] != 0:
                sum_beta_x += coeffs["ln_age_sys_bp_untreated"] * (ln_age * ln_sys_bp)
                
        if smoker:
            sum_beta_x += coeffs["smoker"]
            if coeffs["ln_age_smoker"] != 0:
                sum_beta_x += coeffs["ln_age_smoker"] * ln_age
                
        if diabetes:
            sum_beta_x += coeffs["diabetes"]
            
        # 10-year risk
        risk = 1.0 - (coeffs["s_avg"] ** math.exp(sum_beta_x - coeffs["mean_beta"]))
        risk_pct = round(risk * 100, 2)
        
        category = "low"
        if risk_pct >= 20.0:
            category = "high"
        elif risk_pct >= 7.5:
            category = "borderline/intermediate"
            
        return {
            "score": risk_pct,
            "category": category,
            "status": "calculated"
        }
    except Exception as e:
        logger.warning(f"Unable to calculate ASCVD risk score: {e}")
        return {
            "score": None,
            "category": "unknown",
            "status": "insufficient_data (requires age, gender, cholesterol, bp)"
        }

def calculate_findrisc(profile: Dict[str, Any]) -> Dict[str, Any]:
    """Calculates FINDRISC Diabetes Risk Score"""
    try:
        score = 0
        age = profile.get("age", 30)
        weight = profile.get("weight", 70.0)
        height = profile.get("height", 175.0)
        active = profile.get("lifestyle_active", False)
        smoke = profile.get("lifestyle_smoke", False)
        
        # 1. Age score
        if age < 45:
            score += 0
        elif 45 <= age <= 54:
            score += 2
        elif 55 <= age <= 64:
            score += 3
        else:
            score += 4
            
        # 2. BMI score
        bmi = weight / ((height / 100.0) ** 2)
        if bmi < 25:
            score += 0
        elif 25 <= bmi <= 30:
            score += 1
        else:
            score += 3
            
        # 3. Physical activity
        if not active:
            score += 2
            
        # 4. Blood pressure meds
        if profile.get("bp_treated", False) or profile.get("systolic_bp", 120) > 130:
            score += 2
            
        # 5. History of high blood glucose
        if profile.get("fasting_blood_glucose", 90.0) > 100.0:
            score += 5

        # 6. Family History of Diabetes
        if profile.get("family_history_diabetes", False):
            score += 5

        category = "low"
        if score >= 15:
            category = "high"
        elif score >= 12:
            category = "moderate"
        elif score >= 7:
            category = "slightly elevated"
            
        return {
            "score": score,
            "category": category,
            "status": "calculated"
        }
    except Exception as e:
        logger.warning(f"Unable to calculate FINDRISC diabetes risk score: {e}")
        return {
            "score": None,
            "category": "unknown",
            "status": "insufficient_data"
        }

def calculate_ckd_epi(profile: Dict[str, Any], creatinine: Optional[float] = None) -> Dict[str, Any]:
    """Calculates GFR using 2021 CKD-EPI Creatinine equation (without race term)"""
    try:
        age = profile.get("age")
        gender = profile.get("gender")
        
        # If creatinine is not passed, look in patient profile
        if creatinine is None:
            creatinine = profile.get("creatinine")
            
        if creatinine is None or age is None or gender is None:
            raise ValueError("Creatinine, age, or gender missing.")
            
        scr = float(creatinine)
        
        if gender == "female":
            kappa = 0.7
            alpha = -0.241
            gender_multiplier = 1.012
        else: # male
            kappa = 0.9
            alpha = -0.302
            gender_multiplier = 1.0
            
        scr_term = min(scr / kappa, 1.0) ** alpha
        scr_term_max = max(scr / kappa, 1.0) ** -1.200
        age_term = 0.9938 ** age
        
        egfr = 142 * scr_term * scr_term_max * age_term * gender_multiplier
        egfr = round(egfr, 1)
        
        stage = "G1 (Normal/High)"
        if egfr < 15.0:
            stage = "G5 (Kidney Failure)"
        elif egfr < 30.0:
            stage = "G4 (Severely Decreased)"
        elif egfr < 45.0:
            stage = "G3b (Moderately-to-Severely Decreased)"
        elif egfr < 60.0:
            stage = "G3a (Mildly-to-Moderately Decreased)"
        elif egfr < 90.0:
            stage = "G2 (Mildly Decreased)"
            
        return {
            "egfr": egfr,
            "stage": stage,
            "status": "calculated"
        }
    except Exception as e:
        logger.warning(f"Unable to calculate CKD-EPI eGFR: {e}")
        return {
            "egfr": None,
            "stage": "unknown",
            "status": "insufficient_data (requires age, gender, and creatinine)"
        }

def run_bp_staging(systolic: Optional[int], diastolic: Optional[int]) -> Dict[str, Any]:
    """Determines BP staging based on AHA guidelines"""
    if systolic is None or diastolic is None:
        return {"stage": "unknown", "status": "insufficient_data"}
        
    s = int(systolic)
    d = int(diastolic)
    
    if s > 180 or d > 120:
        stage = "Hypertensive Crisis (Emergency)"
    elif s >= 140 or d >= 90:
        stage = "Stage 2 Hypertension"
    elif (130 <= s <= 139) or (80 <= d <= 89):
        stage = "Stage 1 Hypertension"
    elif (120 <= s <= 129) and d < 80:
        stage = "Elevated"
    elif s < 120 and d < 80:
        stage = "Normal"
    else:
        stage = "Stage 1 Hypertension" # Fallback if cross-boundary (e.g. 115/85)
        
    return {
        "systolic": s,
        "diastolic": d,
        "stage": stage,
        "status": "calculated"
    }

def check_med_allergy_interactions(meds: List[str], allergies: List[str]) -> List[str]:
    """Rule-based lookup for active drug-drug and drug-allergy interactions"""
    warnings = []
    meds_clean = [m.strip().lower() for m in meds]
    allergies_clean = [a.strip().lower() for a in allergies]
    
    # 1. Drug-Drug Interactions
    for i in range(len(meds_clean)):
        for j in range(i + 1, len(meds_clean)):
            m1, m2 = meds_clean[i], meds_clean[j]
            # Check combinations in both orderings
            pair1 = (m1, m2)
            pair2 = (m2, m1)
            
            if pair1 in DRUG_INTERACTIONS:
                warnings.append(f"CRITICAL DRUG INTERACTION: [{m1.upper()} + {m2.upper()}]: {DRUG_INTERACTIONS[pair1]}")
            elif pair2 in DRUG_INTERACTIONS:
                warnings.append(f"CRITICAL DRUG INTERACTION: [{m2.upper()} + {m1.upper()}]: {DRUG_INTERACTIONS[pair2]}")

    # 2. Drug-Allergy Interactions
    for allergy in allergies_clean:
        for med in meds_clean:
            # Check direct matches (e.g. penicillin allergy + penicillin medication)
            if allergy == med or allergy in med or med in allergy:
                warnings.append(f"CRITICAL ALLERGY ALERT: Patient is allergic to {allergy.upper()} and is taking {med.upper()}.")
                continue
                
            # Check grouped allergy matches
            if allergy in ALLERGY_GROUPS:
                related_meds = ALLERGY_GROUPS[allergy]
                if any(rm in med for rm in related_meds):
                    warnings.append(f"CRITICAL ALLERGY ALERT: Patient is allergic to {allergy.upper()} (Class matches {med.upper()}).")

    return warnings

class DeterministicSafetyLayer:
    def evaluate_patient_safety(self, profile_dict: Dict[str, Any], current_vitals: Dict[str, Any]) -> Dict[str, Any]:
        """
        Gathers profile and vitals, executes safety calculators, and returns safety report.
        """
        # Combine profile baseline and current vitals
        combined_profile = {**profile_dict}
        
        # Merge current vitals over profile baselines if present
        if current_vitals.get("systolic_bp"):
            combined_profile["systolic_bp"] = current_vitals["systolic_bp"]
        if current_vitals.get("diastolic_bp"):
            combined_profile["diastolic_bp"] = current_vitals["diastolic_bp"]
        if current_vitals.get("blood_sugar"):
            combined_profile["fasting_blood_glucose"] = current_vitals["blood_sugar"]

        # Run Calculators
        ascvd = calculate_ascvd(combined_profile)
        findrisc = calculate_findrisc(combined_profile)
        
        creatinine = current_vitals.get("creatinine") or combined_profile.get("creatinine")
        gfr = calculate_ckd_epi(combined_profile, creatinine)
        
        sys = current_vitals.get("systolic_bp") or combined_profile.get("systolic_bp")
        dia = current_vitals.get("diastolic_bp") or combined_profile.get("diastolic_bp")
        bp_stage = run_bp_staging(sys, dia)
        
        # Med & Allergy Check
        meds = combined_profile.get("active_medications", [])
        allergies = combined_profile.get("allergies", [])
        interaction_warnings = check_med_allergy_interactions(meds, allergies)

        # Staging critical escalations
        has_escalation = False
        escalation_reason = ""
        
        # If Hypertensive Crisis, high ASCVD with chest complaints, or G5 Kidney Failure
        if bp_stage.get("stage") == "Hypertensive Crisis (Emergency)":
            has_escalation = True
            escalation_reason = "Hypertensive Crisis: BP exceeds 180/120 mmHg."
        elif gfr.get("stage") == "G5 (Kidney Failure)":
            has_escalation = True
            escalation_reason = "Kidney Staging Warning: eGFR is below 15 mL/min/1.73m2 (Kidney Failure)."
        elif len(interaction_warnings) > 0:
            has_escalation = True
            escalation_reason = "; ".join(interaction_warnings[:3]) # capture first 3 alerts
            
        return {
            "ascvd_risk": ascvd,
            "diabetes_risk": findrisc,
            "kidney_gfr": gfr,
            "blood_pressure_stage": bp_stage,
            "medication_allergy_warnings": interaction_warnings,
            "escalate_flag": has_escalation,
            "escalate_reason": escalation_reason
        }

safety_layer = DeterministicSafetyLayer()
