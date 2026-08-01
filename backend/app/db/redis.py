import json
from typing import Optional, List, Dict, Any
import redis.asyncio as aioredis
from app.config import settings

class RedisManager:
    def __init__(self):
        self.client: Optional[aioredis.Redis] = None

    def connect(self):
        self.client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

    async def close(self):
        if self.client:
            await self.client.close()

    # Session Management
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        data = await self.client.get(f"session:{session_id}")
        if data:
            return json.loads(data)
        return None

    async def save_session(self, session_id: str, session_data: Dict[str, Any], ttl: int = 300):
        if not self.client:
            return
        await self.client.setex(
            f"session:{session_id}",
            ttl,
            json.dumps(session_data)
        )

    async def delete_session(self, session_id: str):
        if not self.client:
            return
        await self.client.delete(f"session:{session_id}")

    # Hot Vitals Cache (Last 30 Days)
    async def get_hot_vitals(self, patient_id: str) -> List[Dict[str, Any]]:
        if not self.client:
            return []
        data = await self.client.get(f"hot_vitals:{patient_id}")
        if data:
            return json.loads(data)
        return []

    async def set_hot_vitals(self, patient_id: str, vitals: List[Dict[str, Any]], ttl: int = 86400):
        if not self.client:
            return
        await self.client.setex(
            f"hot_vitals:{patient_id}",
            ttl,
            json.dumps(vitals)
        )

    # Rate Limiting
    async def is_rate_limited(self, identifier: str, limit: int, period: int = 60) -> bool:
        if not self.client:
            return False  # Fail open if Redis is down, but in production we'd handle it
        import time
        current_bucket = int(time.time() / period)
        key = f"rate_limit:{identifier}:{current_bucket}"
        
        # Async transaction or pipeline to increment and set expire
        async with self.client.pipeline(transaction=True) as pipe:
            pipe.incr(key)
            pipe.expire(key, period + 10)
            res = await pipe.execute()
        
        current_requests = res[0]
        return current_requests > limit

redis_manager = RedisManager()
