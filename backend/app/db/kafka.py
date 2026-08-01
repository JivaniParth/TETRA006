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

    async def request_medgemma_inference(self, payload: Dict[str, Any], priority: int = 1) -> str:
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
            "payload": payload
        }

        try:
            # Send to requests queue
            await self.producer.send_and_wait("medgemma_requests", message)
            logger.info(f"Sent MedGemma request {correlation_id} with priority {priority}")
            
            # Await the reply with a timeout (e.g., 12 seconds)
            response = await asyncio.wait_for(future, timeout=12.0)
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
                
                if correlation_id and correlation_id in self.pending_requests:
                    future = self.pending_requests[correlation_id]
                    if not future.done():
                        future.set_result(response_text)
                        logger.debug(f"Resolved future for request {correlation_id}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in Kafka response listener task: {e}")

kafka_manager = KafkaManager()
