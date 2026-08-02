import base64
import io
import json
import logging
from typing import Dict, Any, Tuple, Optional
import httpx
from pypdf import PdfReader
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.db.qdrant import qdrant_manager
from app.services.classifier import classifier_service
from app.models.all_models import Report, Vital

logger = logging.getLogger(__name__)

def check_ranges(extracted_values: Dict[str, Any]) -> bool:
    """Deterministic range plausibility check"""
    try:
        glucose = extracted_values.get("blood_sugar") or extracted_values.get("glucose")
        if glucose is not None:
            val = float(glucose)
            if val < 40.0 or val > 500.0:
                logger.warning(f"Glucose value {val} out of plausible bounds (40-500).")
                return False
                
        sys = extracted_values.get("systolic_bp")
        if sys is not None:
            val = float(sys)
            if val < 60.0 or val > 250.0:
                logger.warning(f"Systolic BP value {val} out of plausible bounds (60-250).")
                return False

        dia = extracted_values.get("diastolic_bp")
        if dia is not None:
            val = float(dia)
            if val < 40.0 or val > 150.0:
                logger.warning(f"Diastolic BP value {val} out of plausible bounds (40-150).")
                return False
                
        return True
    except (ValueError, TypeError):
        return False

def calculate_severity_tier(extracted_values: Dict[str, Any]) -> str:
    """Clinical severity tier calculator"""
    try:
        glucose = extracted_values.get("blood_sugar") or extracted_values.get("glucose")
        sys = extracted_values.get("systolic_bp")
        dia = extracted_values.get("diastolic_bp")
        
        # Critical thresholds
        if glucose is not None and (float(glucose) > 250.0 or float(glucose) < 60.0):
            return "critical"
        if sys is not None and float(sys) > 180.0:
            return "critical"
        if dia is not None and float(dia) > 120.0:
            return "critical"
            
        # Important thresholds
        if glucose is not None and float(glucose) > 140.0:
            return "important"
        if sys is not None and float(sys) > 130.0:
            return "important"
        if dia is not None and float(dia) > 80.0:
            return "important"
            
        return "can_ignore"
    except (ValueError, TypeError):
        return "can_ignore"

class ReportIngestionService:
    async def extract_and_process(
        self,
        db: AsyncSession,
        patient_id: str,
        file_bytes: bytes,
        file_name: str,
        file_type: str
    ) -> Report:
        extracted_text = ""
        extracted_values = {}
        confidence = 0.5
        report_type = "general"
        raw_notes = ""

        # 1. Handle PDF text extraction
        if file_type == "application/pdf":
            try:
                pdf_file = io.BytesIO(file_bytes)
                reader = PdfReader(pdf_file)
                for page in reader.pages:
                    extracted_text += page.extract_text() or ""
                extracted_text = extracted_text.strip()
            except Exception as e:
                logger.error(f"Failed to extract text from PDF: {e}")

        # 2. Fallback to MedGemma vision if scanned PDF or image
        is_scanned = (file_type == "application/pdf" and len(extracted_text) < 10)
        is_image = file_type.startswith("image/")

        if is_scanned or is_image:
            logger.info("Executing MedGemma Multimodal Extraction via Cloudflare Tunnel...")
            img_b64 = base64.b64encode(file_bytes).decode("utf-8")
            
            payload = {
                "model": settings.MEDGEMMA_MODEL_NAME,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": (
                                    "You are a clinical assistant. Extract vitals and clinical metrics. "
                                    "Respond in a strict JSON object with these keys: "
                                    "'extracted_values' (an object mapping metric names like 'systolic_bp', 'diastolic_bp', 'blood_sugar', 'creatinine', 'heart_rate' to numeric values), "
                                    "'confidence' (a float between 0.0 and 1.0), "
                                    "'report_type' (one of: 'lab_report', 'glucometer', 'bp_meter'), "
                                    "'raw_model_notes' (a brief textual summary)."
                                )
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{img_b64}"
                                }
                            }
                        ]
                    }
                ],
                "temperature": 0.1
            }

            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{settings.MEDGEMMA_TUNNEL_URL}/v1/chat/completions",
                        json=payload,
                        timeout=180.0
                    )
                    if response.status_code == 200:
                        content = response.json()["choices"][0]["message"]["content"]
                        # Clean JSON codeblock wrappers if present
                        if "```json" in content:
                            content = content.split("```json")[1].split("```")[0].strip()
                        elif "```" in content:
                            content = content.split("```")[1].split("```")[0].strip()
                            
                        data = json.loads(content)
                        extracted_values = data.get("extracted_values", {})
                        confidence = float(data.get("confidence", 0.7))
                        report_type = data.get("report_type", "general")
                        raw_notes = data.get("raw_model_notes", "")
                    else:
                        logger.error(f"vLLM extraction returned error: {response.text}")
            except Exception as e:
                logger.error(f"Failed to communicate with remote MedGemma tunnel: {e}")
                confidence = 0.0
                raw_notes = f"Inference failed: {str(e)}"
        else:
            # For digital PDF, run a lightweight text prompt on Gemini to parse the extracted text
            logger.info("Parsing digital PDF text using Gemini Flash...")
            try:
                # We can formulate a structured request
                prompt = (
                    f"Read this clinical report text and extract vitals or lab values. "
                    f"Report text: '{extracted_text}'. "
                    f"Response format MUST be strict JSON: "
                    f'{{"extracted_values": {{"systolic_bp": int, "diastolic_bp": int, "blood_sugar": float, "creatinine": float, "heart_rate": int}}, "confidence": float, "report_type": "lab_report"|"bp_meter"|"glucometer", "raw_model_notes": "summary"}}'
                )
                from app.services.classifier import classifier_service
                # Use Gemini client to generate content
                from google import genai
                from google.genai import types
                
                # Check for keys
                if classifier_service.keys and classifier_service.keys != ["placeholder_key"]:
                    genai_client = genai.Client(api_key=classifier_service.keys[classifier_service.current_key_idx])
                    resp = genai_client.models.generate_content(
                        model=classifier_service.models[classifier_service.current_model_idx],
                        contents=prompt,
                        config=types.GenerateContentConfig(response_mime_type="application/json")
                    )
                    data = json.loads(resp.text)
                    extracted_values = data.get("extracted_values", {})
                    confidence = float(data.get("confidence", 0.9))
                    report_type = data.get("report_type", "lab_report")
                    raw_notes = data.get("raw_model_notes", "")
                else:
                    raw_notes = f"Extracted digital text: {extracted_text[:300]}"
                    confidence = 0.5
            except Exception as e:
                logger.error(f"Gemini parsing failed for digital PDF: {e}")
                raw_notes = f"Digital text: {extracted_text[:300]}"
                confidence = 0.5

        # 3. Check Plausibility and Set Save status
        range_passed = check_ranges(extracted_values)
        severity = calculate_severity_tier(extracted_values)
        
        status = "pending_confirmation"
        if confidence >= settings.REPORT_CONFIDENCE_THRESHOLD and range_passed:
            status = "auto_saved"

        # 4. Write to PostgreSQL
        new_report = Report(
            patient_id=patient_id,
            file_name=file_name,
            file_type=file_type,
            extracted_values=extracted_values,
            raw_model_notes=raw_notes,
            confidence=confidence,
            range_check_passed=range_passed,
            status=status,
            severity_tier=severity
        )
        
        db.add(new_report)
        await db.commit()
        await db.refresh(new_report)

        # 5. If auto-saved, sync vitals and indexing immediately
        if status == "auto_saved":
            await self.commit_vitals_and_indexing(db, new_report)

        return new_report

    async def commit_vitals_and_indexing(self, db: AsyncSession, report: Report):
        vals = report.extracted_values
        if not vals:
            return

        # Insert Vitals
        new_vital = Vital(
            patient_id=report.patient_id,
            systolic_bp=vals.get("systolic_bp"),
            diastolic_bp=vals.get("diastolic_bp"),
            blood_sugar=vals.get("blood_sugar") or vals.get("glucose"),
            creatinine=vals.get("creatinine"),
            heart_rate=vals.get("heart_rate")
        )
        db.add(new_vital)
        await db.commit()

        # Update Qdrant semantic index
        summary_text = (
            f"Report Name: {report.file_name}. "
            f"Extracted clinical metrics: {json.dumps(vals)}. "
            f"Notes: {report.raw_model_notes}"
        )
        embedding = await classifier_service.get_embedding(summary_text)
        collection_name = f"patient_kb_{report.patient_id}"
        qdrant_manager.upsert_point(
            collection_name=collection_name,
            point_id=str(report.id),
            vector=embedding,
            payload={
                "type": "report_ingestion",
                "report_id": str(report.id),
                "severity_tier": report.severity_tier,
                "text": summary_text
            }
        )
        logger.info(f"Indexed report {report.id} to Qdrant collection {collection_name}")

report_ingestion_service = ReportIngestionService()
