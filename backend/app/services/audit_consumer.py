import os
import json
import logging
import asyncio
from datetime import datetime
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from aiokafka import AIOKafkaConsumer
from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AuditConsumer:
    def __init__(self):
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.is_running = False
        self.consume_task = None
        self.log_buffer = []
        self.flush_lock = asyncio.Lock()
        self.base_dir = "data/cold_store/audit_log"

    async def start(self):
        self.is_running = True
        max_retries = 10
        retry_delay = 3.0
        
        for attempt in range(max_retries):
            try:
                self.consumer = AIOKafkaConsumer(
                    "audit_log",
                    bootstrap_servers=settings.KAFKA_BROKERS,
                    group_id="audit_consumer_group",
                    auto_offset_reset="earliest",
                    value_deserializer=lambda v: json.loads(v.decode("utf-8"))
                )
                await self.consumer.start()
                logger.info("Audit Consumer: Kafka Consumer started.")
                
                # Start loops
                self.consume_task = asyncio.create_task(self._consume_loop())
                # Periodic flush every 5 seconds
                self.flush_task = asyncio.create_task(self._periodic_flush())
                return
            except Exception as e:
                logger.warning(
                    f"Audit Consumer: Kafka connection attempt {attempt + 1}/{max_retries} failed: {e}. "
                    f"Retrying in {retry_delay} seconds..."
                )
                if self.consumer:
                    try:
                        await self.consumer.stop()
                    except Exception:
                        pass
                    self.consumer = None
                await asyncio.sleep(retry_delay)

        raise RuntimeError("Audit Consumer: Failed to connect to Kafka after multiple attempts.")


    async def stop(self):
        self.is_running = False
        if self.consume_task:
            self.consume_task.cancel()
        if self.flush_task:
            self.flush_task.cancel()
        if self.consumer:
            await self.consumer.stop()
        # Final flush
        await self._flush_buffer()
        logger.info("Audit Consumer: Stopped.")

    async def _consume_loop(self):
        logger.info("Audit Consumer: Listening for audit logs...")
        try:
            async for msg in self.consumer:
                log_entry = msg.value
                async with self.flush_lock:
                    self.log_buffer.append(log_entry)
                logger.info(f"Audit Consumer: Buffered log for patient {log_entry.get('patient_id')}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Audit Consumer: Error in consume loop: {e}")

    async def _periodic_flush(self):
        while self.is_running:
            try:
                await asyncio.sleep(5.0)
                await self._flush_buffer()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Audit Consumer: Error in periodic flush: {e}")

    async def _flush_buffer(self):
        async with self.flush_lock:
            if not self.log_buffer:
                return
            
            logs_to_write = list(self.log_buffer)
            self.log_buffer.clear()
            
        logger.info(f"Audit Consumer: Flushing {len(logs_to_write)} audit logs to Parquet cold store...")
        
        # Group logs by date to write partitioned Parquet files (mimicking Iceberg partitions)
        grouped_logs = {}
        for entry in logs_to_write:
            # Parse timestamp
            ts_str = entry.get("timestamp", datetime.utcnow().isoformat())
            try:
                dt = datetime.fromisoformat(ts_str)
            except ValueError:
                dt = datetime.utcnow()
                
            partition_key = (dt.year, dt.month, dt.day)
            if partition_key not in grouped_logs:
                grouped_logs[partition_key] = []
            grouped_logs[partition_key].append(entry)

        for (year, month, day), entries in grouped_logs.items():
            dir_path = os.path.join(
                self.base_dir,
                f"year={year}",
                f"month={month:02d}",
                f"day={day:02d}"
            )
            os.makedirs(dir_path, exist_ok=True)
            
            # File named with timestamp to prevent overwriting
            filename = f"audit_{int(datetime.utcnow().timestamp() * 1000)}.parquet"
            file_path = os.path.join(dir_path, filename)
            
            try:
                # Convert logs to pandas dataframe, serializing any dicts/lists to JSON strings
                serialized_entries = []
                for entry in entries:
                    serialized_entry = {}
                    for k, v in entry.items():
                        if isinstance(v, (dict, list)):
                            serialized_entry[k] = json.dumps(v)
                        else:
                            serialized_entry[k] = v
                    serialized_entries.append(serialized_entry)

                df = pd.DataFrame(serialized_entries)
                
                # Convert to Arrow Table
                table = pa.Table.from_pandas(df)
                
                # Write to Parquet format
                pq.write_table(table, file_path)
                logger.info(f"Audit Consumer: Wrote {len(entries)} items to {file_path}")
            except Exception as e:
                logger.error(f"Audit Consumer: Failed to write Parquet file: {e}")
                # Restore items to buffer in case of failure
                async with self.flush_lock:
                    self.log_buffer.extend(entries)

if __name__ == "__main__":
    consumer = AuditConsumer()
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(consumer.start())
        loop.run_forever()
    except KeyboardInterrupt:
        loop.run_until_complete(consumer.stop())
