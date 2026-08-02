import logging
import asyncio
from typing import List, Dict, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class EventBroadcaster:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Active broadcast clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Active broadcast clients: {len(self.active_connections)}")

    async def broadcast_emergency(self, event_type: str, alert_data: Dict[str, Any]):
        """
        Broadcasts emergency alert events (new_emergency, emergency_accepted, emergency_cancelled)
        to all connected hospital/clinician dashboard clients in real-time.
        """
        message = {
            "event": event_type,
            "data": alert_data,
            "timestamp": alert_data.get("created_at") or alert_data.get("timestamp")
        }
        
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to WebSocket client: {e}")
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

event_broadcaster = EventBroadcaster()
