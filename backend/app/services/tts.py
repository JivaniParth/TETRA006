import logging
import asyncio
import requests
from app.config import settings

import os

logger = logging.getLogger(__name__)

def get_elevenlabs_api_key() -> str:
    """Retrieve ElevenLabs API key from settings, env, or direct .env file read."""
    # 1. Try pydantic settings
    key = getattr(settings, "ELEVENLABS_API_KEY", "")
    if key and key != "placeholder_key":
        return key
    
    # 2. Try os.getenv
    key = os.getenv("ELEVENLABS_API_KEY", "")
    if key and key != "placeholder_key":
        return key

    # 3. Direct scan of backend/.env files on disk
    possible_paths = [
        os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
        os.path.join(os.path.dirname(__file__), "..", ".env"),
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.getcwd(), "backend", ".env")
    ]
    for path in possible_paths:
        abs_path = os.path.abspath(path)
        if os.path.exists(abs_path):
            try:
                with open(abs_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "ELEVENLABS_API_KEY" in line:
                            parts = line.split("=", 1)
                            if len(parts) == 2 and parts[0].strip() == "ELEVENLABS_API_KEY":
                                val = parts[1].strip().strip('"').strip("'")
                                if val and val != "placeholder_key":
                                    return val
            except Exception:
                pass
    return ""

def get_elevenlabs_voice_id(provided_voice: str = None) -> str:
    """Retrieve ElevenLabs Voice ID from payload, settings, env, or default."""
    if provided_voice and isinstance(provided_voice, str):
        cleaned = provided_voice.strip()
        if cleaned and cleaned not in ["null", "undefined"]:
            return cleaned
            
    voice = getattr(settings, "ELEVENLABS_VOICE_ID", "")
    if voice and isinstance(voice, str):
        cleaned = voice.strip()
        if cleaned and cleaned not in ["placeholder_key", "null", "undefined"]:
            return cleaned

    env_voice = os.getenv("ELEVENLABS_VOICE_ID", "")
    if env_voice and isinstance(env_voice, str):
        cleaned = env_voice.strip()
        if cleaned:
            return cleaned

    # Fallback to standard default ElevenLabs Multilingual Voice (Rachel)
    return "21m00Tcm4TlvDq8ikWAM"

class TTSService:
    def _generate_speech_sync(self, text: str, voice_id: str = None) -> bytes:
        api_key = get_elevenlabs_api_key()
        target_voice = get_elevenlabs_voice_id(voice_id)

        if not api_key:
            raise ValueError("ElevenLabs API key is not configured. Please set ELEVENLABS_API_KEY in backend/.env")

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{target_voice}"
        logger.info(f"Generating ElevenLabs TTS for voice_id: '{target_voice}' ({len(text)} chars)")
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
