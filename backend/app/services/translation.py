import logging
import asyncio
import urllib.parse
import requests
from typing import Tuple

logger = logging.getLogger(__name__)

class TranslationService:
    def _translate_sync(self, text: str, source_lang: str = "auto", target_lang: str = "en") -> Tuple[str, str]:
        """
        Translates text using free Google Translate service.
        Returns (translated_text, detected_source_lang)
        """
        if not text or not text.strip():
            return text, "en"

        try:
            encoded_text = urllib.parse.quote(text)
            url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={source_lang}&tl={target_lang}&dt=t&q={encoded_text}"
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            
            resp = requests.get(url, headers=headers, timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                translated_chunks = []
                if data and data[0]:
                    for chunk in data[0]:
                        if chunk and chunk[0]:
                            translated_chunks.append(chunk[0])
                translated_text = "".join(translated_chunks)
                
                detected_lang = data[2] if len(data) > 2 and isinstance(data[2], str) else source_lang
                return translated_text, detected_lang
        except Exception as e:
            logger.error(f"Translation failed for text '{text[:30]}...': {e}")

        return text, "en"

    async def detect_and_translate_to_english(self, text: str) -> Tuple[str, str]:
        """
        Detects source language and translates text to English.
        Returns: (english_text, detected_language_code)
        """
        return await asyncio.to_thread(self._translate_sync, text, "auto", "en")

    async def translate_from_english(self, text: str, target_lang: str) -> str:
        """
        Translates English text to target language code (e.g. 'hi', 'es', 'fr', 'mr', 'ta').
        If target_lang is 'en', returns original text.
        """
        if not target_lang or target_lang.lower() in ["en", "auto"]:
            return text

        translated, _ = await asyncio.to_thread(self._translate_sync, text, "en", target_lang)
        return translated

translation_service = TranslationService()
