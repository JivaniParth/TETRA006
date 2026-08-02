import logging
import uuid
import time
from typing import Dict, Any, Tuple, Optional
from app.db.redis import redis_manager
from app.services.classifier import classifier_service
from app.config import settings

from sqlalchemy import select
from app.models.all_models import ChatMessage

logger = logging.getLogger(__name__)

class SessionManager:
    async def process_query_turn(
        self,
        patient_id: str,
        user_text: str,
        session_id: Optional[str] = None,
        db: Optional[Any] = None
    ) -> Tuple[Dict[str, Any], bool]:
        """
        Processes a turn of the query.
        Returns:
            (session_state, is_complete)
        """
        current_time = int(time.time())
        
        # 1. Load or Initialize Session
        if not session_id:
            session_id = f"user_{patient_id}_ts_{current_time}"
            session = {
                "session_id": session_id,
                "patient_id": patient_id,
                "original_query": user_text,
                "classified_so_far": {},
                "pending_fields": [],
                "status": "awaiting_user_input",
                "turn_count": 0,
                "history": [{"role": "user", "content": user_text}]
            }
        else:
            session = await redis_manager.get_session(session_id)
            if not session and db is not None:
                # Try hydrating from PostgreSQL if missing in Redis
                msg_stmt = select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc())
                res = await db.execute(msg_stmt)
                db_msgs = res.scalars().all()
                if db_msgs:
                    history = [{"role": msg.role, "content": msg.content} for msg in db_msgs]
                    history.append({"role": "user", "content": user_text})
                    first_user_msg = next((m["content"] for m in history if m["role"] == "user"), user_text)
                    session = {
                        "session_id": session_id,
                        "patient_id": patient_id,
                        "original_query": first_user_msg,
                        "classified_so_far": {},
                        "pending_fields": [],
                        "status": "awaiting_user_input",
                        "turn_count": len([m for m in history if m["role"] == "user"]) - 1,
                        "history": history
                    }

            if not session:
                # Fallback if session expired and not in DB
                session_id = f"user_{patient_id}_ts_{current_time}"
                session = {
                    "session_id": session_id,
                    "patient_id": patient_id,
                    "original_query": user_text,
                    "classified_so_far": {},
                    "pending_fields": [],
                    "status": "awaiting_user_input",
                    "turn_count": 0,
                    "history": [{"role": "user", "content": user_text}]
                }
            else:
                session["history"].append({"role": "user", "content": user_text})
                session["turn_count"] += 1

        # Check if the query is a user asking about their own medical history/problems
        query_lower = user_text.lower()
        is_history_query = any(w in query_lower for w in ["history", "my record", "my problems", "what problems", "my profile", "my diagnostics", "mere history", "meri history", "mere report", "meri report"])

        # Gatekeeping: Check the latest incoming query by itself first
        initial_classification = await classifier_service.classify(user_text)
        initial_qtypes = initial_classification.get("query_type", ["general"])
        
        # If the latest query by itself is general/off-topic, and it is NOT a follow-up answer to pending fields:
        is_clarifying_turn = len(session.get("pending_fields", [])) > 0
        
        if "general" in initial_qtypes and not any(t in ["symptom_check", "medication_info", "report_query"] for t in initial_qtypes) and not is_clarifying_turn and not is_history_query:
            # It's off-topic/general conversation and not a clarification. Deny/Bypass immediately.
            session["status"] = "complete"
            session["is_off_topic"] = True
            session["history"].append({
                "role": "assistant", 
                "content": "I am a medical assistant designed to help with lifestyle health, vital tracking, and clinical triage. I cannot answer general off-topic queries."
            })
            await redis_manager.save_session(session_id, session)
            return session, True

        if is_history_query:
            session["status"] = "complete"
            session["is_history_query"] = True
            session["classified_so_far"] = {
                "urgency": "routine",
                "urgency_score": 0.0,
                "query_type": ["report_query"],
                "body_part": None,
                "duration": None
            }
            session["pending_fields"] = []
            await redis_manager.save_session(session_id, session)
            return session, True

        # 2. Build full context text to classify
        # Concat history so the classifier has full context of the turns
        context_text = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in session["history"]])

        # 3. Classify context
        classification = await classifier_service.classify(context_text)
        
        # Update session classification progress
        session["classified_so_far"] = {
            "urgency": classification.get("urgency", "routine"),
            "urgency_score": classification.get("urgency_score", 0.0),
            "query_type": classification.get("query_type", ["general"]),
            "body_part": classification.get("body_part") or session["classified_so_far"].get("body_part"),
            "duration": classification.get("duration") or session["classified_so_far"].get("duration")
        }

        # 4. Check for critical urgency - BYPASS clarify loop if urgent
        is_urgent = session["classified_so_far"]["urgency"] == "urgent"
        
        # Calculate pending critical fields only if the query type relates to symptoms or report queries
        pending = []
        qtypes = session["classified_so_far"].get("query_type", ["general"])
        requires_symptom_context = any(t in ["symptom_check", "report_query"] for t in qtypes)
        
        if requires_symptom_context:
            if not session["classified_so_far"]["body_part"]:
                pending.append("body_part")
            if not session["classified_so_far"]["duration"]:
                pending.append("duration")
            
        session["pending_fields"] = pending

        # Determine if we should ask follow-ups or complete the session
        max_turns = settings.MAX_SESSION_TURNS
        
        if is_urgent:
            logger.warning(f"Session {session_id} marked as URGENT. Bypassing clarification loop.")
            session["status"] = "complete"
            await redis_manager.save_session(session_id, session)
            return session, True

        if not pending or session["turn_count"] >= max_turns:
            session["status"] = "complete"
            if session["turn_count"] >= max_turns and pending:
                session["incomplete_context"] = True
                logger.info(f"Session {session_id} forced completion due to turn limit.")
            await redis_manager.save_session(session_id, session)
            return session, True

        # Generate follow-up questions for missing fields
        follow_up_msg = ""
        if "body_part" in pending and "duration" in pending:
            follow_up_msg = "Could you please tell me which part of your body is affected, and how long you have been experiencing these symptoms?"
        elif "body_part" in pending:
            follow_up_msg = "Where on your body are you experiencing these symptoms?"
        elif "duration" in pending:
            follow_up_msg = "How long have you been experiencing this symptom?"
            
        session["history"].append({"role": "assistant", "content": follow_up_msg})
        session["status"] = "awaiting_user_input"
        
        # Save to Redis
        await redis_manager.save_session(session_id, session)
        
        # Return state and False (incomplete)
        return session, False

session_manager = SessionManager()
