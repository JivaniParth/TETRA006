import asyncio
import json
import logging
import uuid
from typing import Dict, Any, Optional
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from app.config import settings

logger = logging.getLogger(__name__)

class KafkaManager:
    def __init__(self):
        self.producer: Optional[AIOKafkaProducer] = None
        self.response_consumer: Optional[AIOKafkaConsumer] = None
        self.pending_requests: Dict[str, asyncio.Future] = {}
        self.consumer_task: Optional[asyncio.Task] = None

    async def start(self):
        max_retries = 10
        retry_delay = 3.0
        for attempt in range(max_retries):
            try:
                # Initialize Producer
                self.producer = AIOKafkaProducer(
                    bootstrap_servers=settings.KAFKA_BROKERS,
                    value_serializer=lambda v: json.dumps(v).encode("utf-8")
                )
                await self.producer.start()
                logger.info("Kafka Producer started successfully.")

                # Initialize Response Consumer for request-reply pattern
                self.response_consumer = AIOKafkaConsumer(
                    "medgemma_responses",
                    bootstrap_servers=settings.KAFKA_BROKERS,
                    group_id=f"api_gateway_response_group_{uuid.uuid4()}",
                    auto_offset_reset="earliest",
                    value_deserializer=lambda v: json.loads(v.decode("utf-8"))
                )
                await self.response_consumer.start()
                logger.info("Kafka Response Consumer started successfully.")

                # Start background listener task
                self.consumer_task = asyncio.create_task(self._listen_for_responses())
                return
            except Exception as e:
                logger.warning(
                    f"Kafka connection attempt {attempt + 1}/{max_retries} failed: {e}. "
                    f"Retrying in {retry_delay} seconds..."
                )
                if self.producer:
                    try:
                        await self.producer.stop()
                    except Exception:
                        pass
                    self.producer = None
                if self.response_consumer:
                    try:
                        await self.response_consumer.stop()
                    except Exception:
                        pass
                    self.response_consumer = None
                await asyncio.sleep(retry_delay)
        
        raise RuntimeError("Failed to connect to Kafka after multiple attempts.")


    async def stop(self):
        if self.consumer_task:
            self.consumer_task.cancel()
            try:
                await self.consumer_task
            except asyncio.CancelledError:
                pass
        if self.producer:
            await self.producer.stop()
        if self.response_consumer:
            await self.response_consumer.stop()
        logger.info("Kafka connections stopped.")

    async def send_audit_log(self, log_entry: Dict[str, Any]):
        if not self.producer:
            logger.warning("Kafka producer not active. Skipping audit log.")
            return
        try:
            await self.producer.send_and_wait("audit_log", log_entry)
        except Exception as e:
            logger.error(f"Failed to send audit log to Kafka: {e}")

    async def request_medgemma_inference(
        self,
        payload: Dict[str, Any],
        priority: int = 1,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Sends a query to MedGemma requests queue and awaits response on response queue.
        priority: 0 (urgent), 1 (routine), 2 (background)
        """
        if not self.producer:
            raise RuntimeError("Kafka producer is not running.")
            
        correlation_id = str(uuid.uuid4())
        loop = asyncio.get_running_loop()
        future = loop.create_future()
        self.pending_requests[correlation_id] = future

        message = {
            "correlation_id": correlation_id,
            "priority": priority,
            "payload": payload,
            "metadata": metadata
        }

        try:
            # Send to requests queue
            await self.producer.send_and_wait("medgemma_requests", message)
            logger.info(f"Sent MedGemma request {correlation_id} with priority {priority}")
            
            # Await the reply with a timeout of 300 seconds
            response = await asyncio.wait_for(future, timeout=300.0)
            return response
        except asyncio.TimeoutError:
            logger.error(f"MedGemma request {correlation_id} timed out waiting for response.")
            raise TimeoutError("Inference request timed out.")
        except Exception as e:
            logger.error(f"Error during MedGemma Kafka request-reply: {e}")
            raise e
        finally:
            self.pending_requests.pop(correlation_id, None)

    async def _listen_for_responses(self):
        logger.info("Started listening for MedGemma responses over Kafka...")
        try:
            async for message in self.response_consumer:
                data = message.value
                correlation_id = data.get("correlation_id")
                response_text = data.get("response")
                metadata = data.get("metadata")
                
                if correlation_id:
                    if correlation_id in self.pending_requests:
                        future = self.pending_requests[correlation_id]
                        if not future.done():
                            future.set_result(response_text)
                            logger.debug(f"Resolved future for request {correlation_id}")
                    elif metadata:
                        # Late response (already timed out on gateway)
                        logger.info(f"Received late response for request {correlation_id}. Processing in background...")
                        asyncio.create_task(self._process_late_response(response_text, metadata))
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in Kafka response listener task: {e}")

    async def _process_late_response(self, response_text_en: str, metadata: Dict[str, Any]):
        logger.info(f"Processing late Kafka response for session {metadata.get('session_id')}")
        from app.db.postgres import AsyncSessionLocal
        from app.models.all_models import PatientHistory
        from app.services.classifier import classifier_service
        from app.services.translation import translation_service
        from app.routes.query import save_chat_turn, parse_markdown_to_html
        from app.db.qdrant import qdrant_manager
        from app.services.events import event_broadcaster
        import json

        patient_id = metadata.get("patient_id")
        session_id = metadata.get("session_id")
        original_query = metadata.get("original_query")
        detected_lang = metadata.get("detected_lang")
        user_query_text = metadata.get("user_query_text")

        if not patient_id or not session_id or not original_query:
            logger.warning("Late Kafka response metadata missing critical fields. Skipping.")
            return

        async with AsyncSessionLocal() as db:
            try:
                # 1. Log History in PostgreSQL & Qdrant
                embedding = await classifier_service.get_embedding(original_query)
                import uuid
                history_log = PatientHistory(
                    patient_id=uuid.UUID(patient_id),
                    content_type="query_response",
                    text_content=f"Query: {original_query}\nResponse: {response_text_en}",
                    embedding=embedding
                )
                db.add(history_log)
                await db.flush()

                qdrant_manager.upsert_point(
                    collection_name=f"patient_kb_{patient_id}",
                    point_id=str(history_log.id),
                    vector=embedding,
                    payload={
                        "type": "query_response",
                        "text": f"Patient Query: {original_query}. MedGemma Response: {response_text_en}"
                    }
                )

                # 2. Translate assistant response to user's detected local language
                response_text = await translation_service.translate_from_english(response_text_en, detected_lang)
                html_resp = parse_markdown_to_html(response_text)

                # 3. Save turn to ChatSession & ChatMessage
                await save_chat_turn(db, uuid.UUID(patient_id), session_id, user_query_text, response_text, html_resp)
                await db.commit()

                # 4. Broadcast real-time WebSocket update to notify the frontend
                await event_broadcaster.broadcast_to_user(patient_id, {
                    "type": "chat_history_update",
                    "session_id": session_id
                })
                logger.info(f"Successfully processed late response and sent WebSocket broadcast for session {session_id}")
            except Exception as e:
                logger.error(f"Error processing late response: {e}")
                await db.rollback()

kafka_manager = KafkaManager()
