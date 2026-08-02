import asyncio
import logging
import time
from typing import Dict, Any, Optional
from app.db.kafka import kafka_manager
from app.config import settings

logger = logging.getLogger(__name__)

class CircuitBreakerOpenException(Exception):
    pass

class MedGemmaClient:
    def __init__(self, failure_threshold: int = 3, recovery_time: float = 30.0):
        self.failure_threshold = failure_threshold
        self.recovery_time = recovery_time
        
        self.failure_count = 0
        self.state = "CLOSED"  # "CLOSED", "OPEN", "HALF-OPEN"
        self.last_state_change = time.time()

    def _on_success(self):
        self.failure_count = 0
        self.state = "CLOSED"

    def _on_failure(self):
        self.failure_count += 1
        logger.error(f"MedGemma failure count: {self.failure_count}/{self.failure_threshold}")
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            self.last_state_change = time.time()
            logger.critical(f"MedGemma Circuit Breaker is now OPEN. Cooldown period: {self.recovery_time}s")

    def _check_state(self):
        if self.state == "OPEN":
            if time.time() - self.last_state_change > self.recovery_time:
                self.state = "HALF-OPEN"
                logger.warning("MedGemma Circuit Breaker is now HALF-OPEN. Testing next request...")
            else:
                raise CircuitBreakerOpenException("MedGemma tunnel service is currently unavailable (circuit open).")

    async def call_medgemma(self, prompt: str, is_urgent: bool = False, metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Calls MedGemma via Kafka request-reply topic with retry and circuit breaker logic.
        """
        self._check_state()

        priority = 0 if is_urgent else 1
        payload = {"prompt": prompt}
        
        # Retry parameters
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                # Call Kafka request-reply
                response_text = await kafka_manager.request_medgemma_inference(payload, priority, metadata)
                self._on_success()
                return response_text
            except Exception as e:
                logger.error(f"Attempt {attempt + 1} failed calling MedGemma via Kafka: {e}")
                if attempt == max_retries:
                    self._on_failure()
                    # Fallback response: clinical warnings with AI disclaimer
                    return (
                        "I am sorry, but I am unable to reach the clinical reasoning model at this moment. "
                        "Here are the deterministic safety checks for your review: "
                        "\n[Deterministic Safety Checks were performed successfully but MedGemma is offline. "
                        "Please refer to the safety flags and alerts in your dashboard.]\n\n"
                        "Disclaimer: This is an AI system which may make mistakes. This analysis is for clinical decision support "
                        "and does not constitute a formal diagnosis. Please consult a qualified healthcare provider. "
                        "The goal of this system is to assist in early detection and support clinical reasoning, "
                        "reducing dependency on routine physician triage."
                    )
                # Wait briefly before retrying
                await asyncio.sleep(1.0)
                
        # unreachable fallback
        return "MedGemma Service Unavailable."

medgemma_client = MedGemmaClient()
