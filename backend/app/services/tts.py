import logging
import asyncio
import requests
from app.config import settings

import os

logger = logging.getLogger(__name__)

class TTSService:
    def _generate_speech_sync(self, text: str, voice_id: str = None) -> bytes:
        api_key = settings.ELEVENLABS_API_KEY or os.getenv("ELEVENLABS_API_KEY", "")
        target_voice = voice_id or settings.ELEVENLABS_VOICE_ID or "21m00Tcm4TlvDq8ikWAM"

        if not api_key or api_key == "placeholder_key":
            raise ValueError("ElevenLabs API key is not configured. Please set ELEVENLABS_API_KEY in backend/.env")

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{target_voice}"
        headers = {
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
        }
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }

        response = requests.post(url, json=payload, headers=headers, timeout=20)
        if response.status_code != 200:
            logger.error(f"ElevenLabs TTS failed with status {response.status_code}: {response.text}")
            raise RuntimeError(f"ElevenLabs TTS API error ({response.status_code}): {response.text}")

        return response.content

    async def generate_speech(self, text: str, voice_id: str = None) -> bytes:
        """Generates audio/mpeg speech bytes using ElevenLabs API."""
        return await asyncio.to_thread(self._generate_speech_sync, text, voice_id)

tts_service = TTSService()
