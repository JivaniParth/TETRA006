import httpx
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from schemas import Base64ImageRequest
from utils import file_to_base64, build_payload, LLAMA_SERVER_URL

router = APIRouter()


# --- JSON route (base64 image in body) ---
@router.post("/json")
async def infer_json(request: Base64ImageRequest):
    payload = build_payload(request.prompt, request.image_base64)
    return await _call_llama_server(payload)


# --- Multipart route (file upload) ---
@router.post("/upload")
async def infer_upload(
    prompt: str = Form(...),
    image: UploadFile = File(None),
):
    image_base64 = await file_to_base64(image) if image else None
    payload = build_payload(prompt, image_base64)
    return await _call_llama_server(payload)


async def _call_llama_server(payload: dict):
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(LLAMA_SERVER_URL, json=payload)
            response.raise_for_status()
            data = response.json()
            text = data["choices"][0]["message"]["content"]
            return JSONResponse(content={"response": text})
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"llama-server error: {e.response.text}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"llama-server unreachable: {str(e)}")