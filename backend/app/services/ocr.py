import re
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class OCRLabParser:
    def extract_vitals_from_text(self, text: str) -> Dict[str, Any]:
        """
        Parses raw report text using deterministic regex patterns
        to extract common vital and laboratory values.
        """
        extracted = {}
        if not text:
            return extracted

        # Systolic & Diastolic Blood Pressure (e.g. 120/80 mmHg, 130 / 85)
        bp_match = re.search(r'(\b1\d{2}|\b2[0-0]\d|\b[8-9]\d)\s*[\/\\]\s*(\b[5-9]\d|\b1[0-2]\d)\s*(?:mmHg)?', text, re.IGNORECASE)
        if bp_match:
            try:
                extracted["systolic_bp"] = int(bp_match.group(1))
                extracted["diastolic_bp"] = int(bp_match.group(2))
            except Exception:
                pass

        # Blood Glucose / Sugar (e.g. Glucose: 110 mg/dL, Fasting Sugar 95 mg/dl)
        glucose_match = re.search(r'(?:glucose|sugar|blood\s+glucose|fasting\s+glucose)\s*[:=\-]?\s*(\d{2,3}(?:\.\d{1,2})?)\s*(?:mg\/dL)?', text, re.IGNORECASE)
        if glucose_match:
            try:
                extracted["blood_sugar"] = float(glucose_match.group(1))
            except Exception:
                pass

        # Serum Creatinine (e.g. Creatinine: 1.2 mg/dL)
        creatinine_match = re.search(r'(?:creatinine|serum\s+creatinine)\s*[:=\-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:mg\/dL)?', text, re.IGNORECASE)
        if creatinine_match:
            try:
                extracted["creatinine"] = float(creatinine_match.group(1))
            except Exception:
                pass

        # Heart Rate / Pulse (e.g. Pulse: 72 bpm, HR 80)
        pulse_match = re.search(r'(?:pulse|heart\s+rate|hr)\s*[:=\-]?\s*(\d{2,3})\s*(?:bpm)?', text, re.IGNORECASE)
        if pulse_match:
            try:
                extracted["heart_rate"] = int(pulse_match.group(1))
            except Exception:
                pass

        logger.info(f"OCR Parsed lab values from text: {extracted}")
        return extracted

ocr_parser = OCRLabParser()
