from pydantic import BaseModel
from typing import Optional

class TextOnlyRequest(BaseModel):
    prompt: str

class Base64ImageRequest(BaseModel):
    prompt: str
    image_base64: str  # raw base64, no data URI prefix needed