import logging
import json
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from app.config import settings
from app.services.rules import fallback_classify

logger = logging.getLogger(__name__)

# Pydantic schema for Gemini structured JSON output
class ClassificationSchema(BaseModel):
    urgency: str = Field(description="Must be 'urgent' or 'routine'")
    urgency_score: float = Field(description="Urgency/severity confidence score from 0.0 to 1.0")
    query_type: List[str] = Field(description="List of types: 'symptom_check', 'medication_info', 'report_query', 'general'")
    body_part: Optional[str] = Field(None, description="Body part affected (e.g., chest, head, abdomen, limbs, skin, urinary, etc.) or null")
    duration: Optional[str] = Field(None, description="Duration of symptom (e.g., '2 hours', '3 days', etc.) or null")
    missing_fields: List[str] = Field(description="Specify which critical fields from ('body_part', 'duration') are completely missing from the user text")

class RotatingClassifier:
    def __init__(self):
        self.keys = settings.gemini_keys_list
        self.models = settings.gemini_models_list
        self.current_key_idx = 0
        self.current_model_idx = 0

    def _rotate_keys(self):
        if not self.keys:
            return
        self.current_key_idx = (self.current_key_idx + 1) % len(self.keys)
        logger.info(f"Rotated to Gemini API key index: {self.current_key_idx}")

    def _rotate_models(self):
        if not self.models:
            return
        self.current_model_idx = (self.current_model_idx + 1) % len(self.models)
        logger.info(f"Rotated to Gemini Model: {self.models[self.current_model_idx]}")

    async def classify(self, text: str) -> Dict[str, Any]:
        if not self.keys or self.keys == ["placeholder_key"]:
            logger.warning("No valid Gemini API keys found. Using rule-based fallback classifier.")
            return fallback_classify(text)

        attempts = len(self.keys) * len(self.models)
        for _ in range(attempts):
            api_key = self.keys[self.current_key_idx]
            model_name = self.models[self.current_model_idx]
            try:
                # Initialize client for current key
                client = genai.Client(api_key=api_key)
                
                prompt = (
                    f"Analyze the following patient query for decision support: '{text}'.\n"
                    "Extract the fields as requested in the JSON schema. "
                    "Make sure to identify if critical fields ('body_part', 'duration') are missing. "
                    "If the patient lists symptoms but does not specify how long it's been happening, 'duration' is missing. "
                    "If they don't specify where it hurts/occurs, 'body_part' is missing."
                )

                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=ClassificationSchema,
                        temperature=0.1
                    ),
                )
                
                # Load response text as JSON
                result = json.loads(response.text)
                logger.info(f"Successfully classified query using model {model_name}.")
                return result

            except Exception as e:
                logger.error(
                    f"Gemini API failure using key index {self.current_key_idx} and model {model_name}: {e}"
                )
                # Rotate key, and occasionally model
                self._rotate_keys()
                self._rotate_models()

        logger.error("All Gemini API keys and models exhausted. Using rule-based fallback.")
        return fallback_classify(text)

    async def get_embedding(self, text: str) -> List[float]:
        if not self.keys or self.keys == ["placeholder_key"]:
            # Dummy embedding of size 768
            return [0.0] * 768
        for _ in range(len(self.keys)):
            api_key = self.keys[self.current_key_idx]
            try:
                client = genai.Client(api_key=api_key)
                response = client.models.embed_content(
                    model="text-embedding-004",
                    contents=text
                )
                embedding = response.embeddings[0].values
                return embedding
            except Exception as e:
                logger.error(f"Gemini Embedding API failure with key index {self.current_key_idx}: {e}")
                self._rotate_keys()
        return [0.0] * 768

classifier_service = RotatingClassifier()

