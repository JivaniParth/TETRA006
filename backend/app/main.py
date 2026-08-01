import logging
import asyncio
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.db.postgres import Base, engine
from app.db.redis import redis_manager
from app.db.qdrant import qdrant_manager
from app.db.kafka import kafka_manager
from app.services.auth import JWT_SECRET, JWT_ALGORITHM

# Import routers
from app.routes.auth import router as auth_router
from app.routes.query import router as query_router
from app.routes.reports import router as reports_router
from app.routes.patient import router as patient_router
from app.routes.clinician import router as clinician_router

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MedGuard Backend",
    description="Clinical Decision Support Backend for Prevention of Lifestyle Diseases",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate Limiting Middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Bypass health checks or docs
    if request.url.path in ["/health", "/docs", "/openapi.json"]:
        return await call_next(request)

    # Resolve rate limit identifier
    identifier = request.client.host if request.client else "unknown"
    auth_header = request.headers.get("Authorization")
    
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            email = payload.get("sub")
            if email:
                identifier = email
        except Exception:
            pass  # Fallback to IP if token is invalid or expired
            
    is_limited = await redis_manager.is_rate_limited(
        identifier=identifier,
        limit=settings.RATE_LIMIT_PER_MIN,
        period=60
    )
    
    if is_limited:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Too many requests. Rate limit exceeded."}
        )
        
    return await call_next(request)

# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("Starting up infrastructure connections...")
    
    # 1. Initialize Postgres Tables & Extensions
    try:
        async with engine.begin() as conn:
            # Enable pgvector extension
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            await conn.run_sync(Base.metadata.create_all)
            logger.info("PostgreSQL database tables and pgvector verified.")
    except Exception as e:
        logger.error(f"PostgreSQL connection/initialization failed: {e}")

    # 2. Initialize Redis
    try:
        redis_manager.connect()
        logger.info("Connected to Redis server.")
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")

    # 3. Initialize Qdrant
    try:
        qdrant_manager.connect()
        logger.info("Connected to Qdrant server.")
    except Exception as e:
        logger.error(f"Qdrant connection failed: {e}")

    # 4. Initialize Kafka Producer & Consumer
    try:
        await kafka_manager.start()
        logger.info("Connected to Kafka brokers.")
    except Exception as e:
        logger.error(f"Kafka initialization failed: {e}")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down infrastructure connections...")
    await redis_manager.close()
    await kafka_manager.stop()

# Register Routers
app.include_router(auth_router)
app.include_router(query_router)
app.include_router(reports_router)
app.include_router(patient_router)
app.include_router(clinician_router)

# Health endpoints
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }

from datetime import datetime
