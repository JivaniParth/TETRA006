import logging
import uuid
import time
from typing import Optional
from app.config import settings
from app.db.qdrant import qdrant_manager
from app.services.classifier import classifier_service

logger = logging.getLogger(__name__)

class SemanticCacheService:
    async def lookup(self, patient_id: str, query_text: str) -> Optional[str]:
        """
        Looks up the query in the patient-scoped semantic cache.
        Returns the cached string if cosine similarity >= 0.92, otherwise None.
        """
        try:
            collection_name = f"cache_{patient_id}"
            query_vector = await classifier_service.get_embedding(query_text)
            
            # Search Qdrant with threshold
            threshold = settings.SEMANTIC_CACHE_THRESHOLD
            results = qdrant_manager.search_points(
                collection_name=collection_name,
                query_vector=query_vector,
                limit=1,
                score_threshold=threshold
            )
            
            if results:
                hit = results[0]
                logger.info(f"Semantic cache HIT for patient {patient_id} (Score: {hit['score']:.4f}).")
                return hit["payload"].get("cached_response")
                
            logger.info(f"Semantic cache MISS for patient {patient_id}.")
            return None
        except Exception as e:
            logger.error(f"Error checking semantic cache: {e}")
            return None

    async def update(self, patient_id: str, query_text: str, response_text: str):
        """
        Saves a query-response pair to the patient's semantic cache collection.
        """
        try:
            collection_name = f"cache_{patient_id}"
            query_vector = await classifier_service.get_embedding(query_text)
            
            point_id = str(uuid.uuid4())
            payload = {
                "query": query_text,
                "cached_response": response_text,
                "created_at": int(time.time())
            }
            
            qdrant_manager.upsert_point(
                collection_name=collection_name,
                point_id=point_id,
                vector=query_vector,
                payload=payload
            )
            logger.info(f"Cached response in Qdrant collection {collection_name}")
        except Exception as e:
            logger.error(f"Failed to update semantic cache: {e}")

semantic_cache = SemanticCacheService()
