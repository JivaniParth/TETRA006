import logging
from typing import Optional, List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from qdrant_client.http.exceptions import UnexpectedResponse
from app.config import settings

logger = logging.getLogger(__name__)

class QdrantManager:
    def __init__(self):
        self.client: Optional[QdrantClient] = None

    def connect(self):
        self.client = QdrantClient(url=settings.QDRANT_URL)

    def init_collection(self, collection_name: str, size: int = 768) -> bool:
        if not self.client:
            return False
        try:
            # Check if collection exists
            collections = self.client.get_collections().collections
            collection_names = [c.name for c in collections]
            if collection_name not in collection_names:
                self.client.create_collection(
                    collection_name=collection_name,
                    vectors_config=qmodels.VectorParams(
                        size=size,
                        distance=qmodels.Distance.COSINE
                    )
                )
                logger.info(f"Created Qdrant collection: {collection_name}")
            return True
        except Exception as e:
            logger.error(f"Error initializing Qdrant collection {collection_name}: {e}")
            return False

    def upsert_point(self, collection_name: str, point_id: str, vector: List[float], payload: Dict[str, Any]) -> bool:
        if not self.client:
            return False
        try:
            self.init_collection(collection_name, size=len(vector))
            self.client.upsert(
                collection_name=collection_name,
                points=[
                    qmodels.PointStruct(
                        id=point_id,
                        vector=vector,
                        payload=payload
                    )
                ]
            )
            return True
        except Exception as e:
            logger.error(f"Failed to upsert to Qdrant collection {collection_name}: {e}")
            return False

    def search_points(
        self,
        collection_name: str,
        query_vector: List[float],
        limit: int = 5,
        score_threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        if not self.client:
            return []
        try:
            self.init_collection(collection_name, size=len(query_vector))
            res = self.client.query_points(
                collection_name=collection_name,
                query=query_vector,
                limit=limit,
                score_threshold=score_threshold
            )
            return [
                {
                    "id": r.id,
                    "score": r.score,
                    "payload": r.payload
                }
                for r in res.points
            ]
        except Exception as e:
            logger.error(f"Failed to search Qdrant collection {collection_name}: {e}")
            return []

qdrant_manager = QdrantManager()
