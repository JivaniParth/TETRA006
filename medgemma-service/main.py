from fastapi import FastAPI
from routers.inference import router

app = FastAPI(title="MedGemma Service")
app.include_router(router, prefix="/infer")