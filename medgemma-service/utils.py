import base64
from fastapi import UploadFile

# llama-server's OpenAI-compatible endpoint (started with llama-server.exe)
LLAMA_SERVER_URL = "http://localhost:8080/v1/chat/completions"
MODEL_NAME = "medgemma-1.5-4b-it"  # cosmetic only, llama-server ignores this and uses whatever it loaded

async def file_to_base64(file: UploadFile) -> str:
    contents = await file.read()
    return base64.b64encode(contents).decode("utf-8")

def build_payload(prompt: str, image_base64: str | None = None) -> dict:
    content = [{"type": "text", "text": prompt}]
    if image_base64:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
        })

    payload = {
        "model": MODEL_NAME,
        "messages": [{"role": "user", "content": content}],
        "stream": False,
    }
    return payload