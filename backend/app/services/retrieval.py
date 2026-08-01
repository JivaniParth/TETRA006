import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.redis import redis_manager
from app.db.qdrant import qdrant_manager
from app.services.classifier import classifier_service
from app.models.all_models import Vital, PatientHistory, Report

logger = logging.getLogger(__name__)

async def fetch_redis_hot_vitals(patient_id: str, db: AsyncSession) -> List[Dict[str, Any]]:
    try:
        hot_vitals = await redis_manager.get_hot_vitals(patient_id)
        if hot_vitals:
            logger.info(f"Hot vitals hit in Redis for patient {patient_id}.")
            return hot_vitals
            
        # If cache miss, fetch last 30 days from Postgres and write to Redis
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        q = select(Vital).where(
            and_(
                Vital.patient_id == patient_id,
                Vital.recorded_at >= thirty_days_ago
            )
        ).order_by(Vital.recorded_at.desc())
        
        res = await db.execute(q)
        vitals_list = res.scalars().all()
        
        vitals_payload = [
            {
                "id": str(v.id),
                "systolic_bp": v.systolic_bp,
                "diastolic_bp": v.diastolic_bp,
                "blood_sugar": v.blood_sugar,
                "creatinine": v.creatinine,
                "heart_rate": v.heart_rate,
                "recorded_at": v.recorded_at.isoformat()
            }
            for v in vitals_list
        ]
        
        # Cache in Redis
        await redis_manager.set_hot_vitals(patient_id, vitals_payload)
        logger.info(f"Cached {len(vitals_payload)} vitals in Redis for patient {patient_id}.")
        return vitals_payload
    except Exception as e:
        logger.error(f"Error fetching hot vitals from Redis/DB: {e}")
        return []

async def fetch_qdrant_semantic_history(patient_id: str, query_text: str) -> List[Dict[str, Any]]:
    try:
        # Create embedding for the patient's current query
        query_vector = await classifier_service.get_embedding(query_text)
        collection_name = f"patient_kb_{patient_id}"
        
        # Search Qdrant for similar historical notes, reports, and knowledge base matches
        results = qdrant_manager.search_points(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=4
        )
        return results
    except Exception as e:
        logger.error(f"Error in Qdrant history retrieval: {e}")
        return []

async def fetch_postgres_warm_history(patient_id: str, db: AsyncSession) -> Dict[str, Any]:
    try:
        now = datetime.utcnow()
        thirty_days_ago = now - timedelta(days=30)
        twelve_months_ago = now - timedelta(days=365)
        
        # 1. Warm vitals (older than 30 days up to 12 months)
        vitals_query = select(Vital).where(
            and_(
                Vital.patient_id == patient_id,
                Vital.recorded_at < thirty_days_ago,
                Vital.recorded_at >= twelve_months_ago
            )
        ).order_by(Vital.recorded_at.desc())
        
        # 2. Warm reports (6-12 months)
        reports_query = select(Report).where(
            and_(
                Report.patient_id == patient_id,
                Report.created_at >= twelve_months_ago
            )
        ).order_by(Report.created_at.desc())

        # Execute queries concurrently in SQL session
        vitals_task = db.execute(vitals_query)
        reports_task = db.execute(reports_query)
        
        vitals_res, reports_res = await asyncio.gather(vitals_task, reports_task)
        
        v_list = vitals_res.scalars().all()
        r_list = reports_res.scalars().all()
        
        return {
            "vitals_warm": [
                {
                    "recorded_at": v.recorded_at.isoformat(),
                    "systolic_bp": v.systolic_bp,
                    "diastolic_bp": v.diastolic_bp,
                    "blood_sugar": v.blood_sugar,
                    "creatinine": v.creatinine
                }
                for v in v_list
            ],
            "reports_warm": [
                {
                    "file_name": r.file_name,
                    "extracted_values": r.extracted_values,
                    "severity_tier": r.severity_tier,
                    "status": r.status,
                    "created_at": r.created_at.isoformat()
                }
                for r in r_list
            ]
        }
    except Exception as e:
        logger.error(f"Error fetching warm PostgreSQL history: {e}")
        return {"vitals_warm": [], "reports_warm": []}

class ParallelRetrievalEngine:
    async def gather_context(self, db: AsyncSession, patient_id: str, query_text: str) -> Dict[str, Any]:
        """
        Executes parallel reads across Redis (hot), Qdrant (semantic), and PostgreSQL (warm).
        """
        redis_task = fetch_redis_hot_vitals(patient_id, db)
        qdrant_task = fetch_qdrant_semantic_history(patient_id, query_text)
        postgres_task = fetch_postgres_warm_history(patient_id, db)
        
        hot_vitals, semantic_hits, warm_history = await asyncio.gather(
            redis_task,
            qdrant_task,
            postgres_task
        )
        
        return {
            "hot_vitals": hot_vitals,
            "semantic_history": semantic_hits,
            "vitals_warm": warm_history.get("vitals_warm", []),
            "reports_warm": warm_history.get("reports_warm", [])
        }

retrieval_engine = ParallelRetrievalEngine()
