import asyncio
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.db.qdrant import qdrant_manager
from app.db.kafka import kafka_manager

import uuid
from app.models.all_models import Patient, PatientProfile, ClinicianEscalation, PatientHistory, ChatSession, ChatMessage
from app.models.schemas import QueryRequest, QueryResponse
from app.services.auth import get_current_user, RoleChecker
from app.services.session import session_manager
from app.services.markdown import parse_markdown_to_html
from app.services.cache import semantic_cache
from app.services.retrieval import retrieval_engine
from app.services.safety import safety_layer
from app.services.context import context_assembler
from app.services.llm import medgemma_client
from app.services.classifier import classifier_service

router = APIRouter(prefix="/query", tags=["Query Engine"])
allow_patient = RoleChecker(["patient"])

logger = logging.getLogger(__name__)

async def save_chat_turn(
    db: AsyncSession,
    patient_id: uuid.UUID,
    session_id: str,
    user_text: str,
    assistant_response: str,
    html_response: str = None
):
    """Helper to persist chat sessions and messages in PostgreSQL."""
    try:
        stmt = select(ChatSession).where(ChatSession.id == session_id)
        res = await db.execute(stmt)
        chat_sess = res.scalars().first()
        if not chat_sess:
            title_snippet = user_text[:50] + ("..." if len(user_text) > 50 else "")
            chat_sess = ChatSession(
                id=session_id,
                patient_id=patient_id,
                title=title_snippet
            )
            db.add(chat_sess)
        else:
            chat_sess.updated_at = datetime.utcnow()
        
        user_msg = ChatMessage(
            session_id=session_id,
            role="user",
            content=user_text
        )
        asst_msg = ChatMessage(
            session_id=session_id,
            role="assistant",
            content=assistant_response,
            html_content=html_response
        )
        db.add(user_msg)
        db.add(asst_msg)
        await db.commit()
    except Exception as e:
        logger.error(f"Error saving chat turn for session {session_id}: {e}")
        await db.rollback()

@router.post("", response_model=QueryResponse)
async def clinical_query(
    payload: QueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Patient = Depends(allow_patient)
):
    patient_id = str(current_user.id)
    
    # 1. Process Multi-turn Dialog Step
    session_state, is_complete = await session_manager.process_query_turn(
        patient_id=patient_id,
        user_text=payload.text,
        session_id=payload.session_id,
        db=db
    )

    session_id = session_state["session_id"]

    # If the session is still gathering details (clarification turns), return immediately
    if not is_complete:
        # Get the assistant's last question from history
        assistant_question = session_state["history"][-1]["content"]
        html_resp = parse_markdown_to_html(assistant_question)
        await save_chat_turn(db, current_user.id, session_id, payload.text, assistant_question, html_resp)
        return {
            "session_id": session_id,
            "response": assistant_question,
            "html_response": html_resp,
            "status": "awaiting_user_input",
            "pending_fields": session_state["pending_fields"],
            "safety_alerts": []
        }

    # If complete (or bypassed because of urgency), continue to clinical pipeline
    original_query = session_state["original_query"]

    # 2. Check Semantic Cache
    cached_response = await semantic_cache.lookup(patient_id, original_query)
    if cached_response:
        html_cached = parse_markdown_to_html(cached_response)
        await save_chat_turn(db, current_user.id, session_id, payload.text, cached_response, html_cached)

        # Fire-and-forget async audit log task
        audit_entry = {
            "patient_id": patient_id,
            "query": original_query,
            "cache_hit": True,
            "response": cached_response,
            "timestamp": datetime.utcnow().isoformat()
        }
        asyncio.create_task(kafka_manager.send_audit_log(audit_entry))
        
        return {
            "session_id": session_id,
            "response": cached_response,
            "html_response": html_cached,
            "status": "complete",
            "pending_fields": [],
            "safety_alerts": []
        }

    # 3. Parallel Retrieval (Redis, Qdrant, Postgres)
    retrieved_context = await retrieval_engine.gather_context(db, patient_id, original_query)

    # 4. Deterministic Safety Layer
    # Fetch profile
    profile_query = select(PatientProfile).where(PatientProfile.patient_id == current_user.id)
    profile_res = await db.execute(profile_query)
    profile = profile_res.scalars().first()

    if not profile:
        # Fallback profile if patient hasn't submitted intake data
        logger.warning(f"Patient {patient_id} query processed without intake profile. Using fallback values.")
        profile_dict = {
            "age": 35,
            "gender": "male",
            "race": "other",
            "height": 175.0,
            "weight": 70.0,
            "systolic_bp": 120,
            "diastolic_bp": 80,
            "fasting_blood_glucose": 90.0,
            "active_medications": [],
            "allergies": []
        }
    else:
        profile_dict = {
            "age": profile.age,
            "gender": profile.gender,
            "race": profile.race,
            "height": profile.height,
            "weight": profile.weight,
            "systolic_bp": profile.systolic_bp,
            "diastolic_bp": profile.diastolic_bp,
            "fasting_blood_glucose": profile.fasting_blood_glucose,
            "active_medications": profile.active_medications,
            "allergies": profile.allergies,
            "lifestyle_smoke": profile.lifestyle_smoke,
            "lifestyle_active": profile.lifestyle_active,
            "alcohol_consumption": profile.alcohol_consumption,
            "sleep_duration": profile.sleep_duration,
            "sleep_quality": profile.sleep_quality,
            "tobacco_consumption": profile.tobacco_consumption,
            "past_operations": profile.past_operations,
            "medical_history": profile.medical_history
        }

    # Extract current vitals (most recent from Redis cache)
    current_vitals = {}
    if retrieved_context.get("hot_vitals"):
        latest = retrieved_context["hot_vitals"][0]
        current_vitals = {
            "systolic_bp": latest.get("systolic_bp"),
            "diastolic_bp": latest.get("diastolic_bp"),
            "blood_sugar": latest.get("blood_sugar"),
            "creatinine": latest.get("creatinine"),
            "heart_rate": latest.get("heart_rate")
        }

    safety_output = safety_layer.evaluate_patient_safety(profile_dict, current_vitals)

    # 5. Handle Clinician Escalations (if safety flags are triggered or urgency is high)
    is_urgent = session_state["classified_so_far"].get("urgency") == "urgent"
    should_escalate = safety_output.get("escalate_flag", False) or is_urgent
    
    if should_escalate:
        escalation_reason = safety_output.get("escalate_reason")
        if not escalation_reason:
            escalation_reason = f"Urgent Symptom Classified: {session_state['classified_so_far'].get('body_part')} symptoms for {session_state['classified_so_far'].get('duration')}"
            
        escalation = ClinicianEscalation(
            patient_id=current_user.id,
            query_id=session_id,
            reason=escalation_reason,
            severity_tier="critical" if is_urgent else "important",
            status="pending"
        )
        db.add(escalation)
        await db.commit()
        logger.warning(f"Clinician escalation registered for patient {patient_id}. Reason: {escalation_reason}")

    # 6. Context Assembler (includes full session_history for prior context awareness)
    prompt = context_assembler.assemble_medgemma_prompt(
        query_text=original_query,
        classification=session_state["classified_so_far"],
        profile_dict=profile_dict,
        safety_output=safety_output,
        retrieved_context=retrieved_context,
        session_history=session_state.get("history", [])
    )

    # 7. MedGemma Inference via Kafka Request-Reply Client
    response_text = await medgemma_client.call_medgemma(prompt, is_urgent=is_urgent)

    # 8. Save Response in Semantic Cache
    await semantic_cache.update(patient_id, original_query, response_text)

    # 9. Log History in PostgreSQL & Qdrant
    embedding = await classifier_service.get_embedding(original_query)
    history_log = PatientHistory(
        patient_id=current_user.id,
        content_type="query_response",
        text_content=f"Query: {original_query}\nResponse: {response_text}",
        embedding=embedding
    )
    db.add(history_log)
    await db.flush()
    
    qdrant_manager.upsert_point(
        collection_name=f"patient_kb_{patient_id}",
        point_id=str(history_log.id),
        vector=embedding,
        payload={
            "type": "query_response",
            "text": f"Patient Query: {original_query}. MedGemma Response: {response_text}"
        }
    )
    
    await db.commit()

    # Save turn to ChatSession & ChatMessage
    html_resp = parse_markdown_to_html(response_text)
    await save_chat_turn(db, current_user.id, session_id, payload.text, response_text, html_resp)

    # 10. Write Fire-and-Forget Audit Log to Kafka
    audit_entry = {
        "patient_id": patient_id,
        "query": original_query,
        "classification": session_state["classified_so_far"],
        "retrieved_context_summary": {
            "hot_vitals_count": len(retrieved_context["hot_vitals"]),
            "semantic_history_count": len(retrieved_context["semantic_history"]),
            "vitals_warm_count": len(retrieved_context["vitals_warm"]),
            "reports_warm_count": len(retrieved_context["reports_warm"])
        },
        "safety_output": safety_output,
        "response": response_text,
        "timestamp": datetime.utcnow().isoformat()
    }
    asyncio.create_task(kafka_manager.send_audit_log(audit_entry))

    # 11. Return response to user
    return {
        "session_id": session_id,
        "response": response_text,
        "html_response": html_resp,
        "status": "complete",
        "pending_fields": [],
        "safety_alerts": safety_output.get("medication_allergy_warnings", [])
    }

# --- Chat History Endpoints ---

@router.get("/sessions")
async def get_chat_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: Patient = Depends(allow_patient)
):
    """Retrieve list of chat sessions for the logged-in patient."""
    stmt = (
        select(ChatSession)
        .where(ChatSession.patient_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    res = await db.execute(stmt)
    sessions = res.scalars().all()
    return [
        {
            "session_id": s.id,
            "title": s.title,
            "created_at": s.created_at.isoformat(),
            "updated_at": s.updated_at.isoformat()
        }
        for s in sessions
    ]

@router.get("/sessions/{session_id}")
async def get_chat_messages(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Patient = Depends(allow_patient)
):
    """Retrieve messages for a given chat session."""
    sess_stmt = select(ChatSession).where(
        ChatSession.id == session_id,
        ChatSession.patient_id == current_user.id
    )
    sess_res = await db.execute(sess_stmt)
    chat_sess = sess_res.scalars().first()
    if not chat_sess:
        raise HTTPException(status_code=404, detail="Chat session not found")

    msg_stmt = (
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    msg_res = await db.execute(msg_stmt)
    messages = msg_res.scalars().all()
    return {
        "session_id": chat_sess.id,
        "title": chat_sess.title,
        "created_at": chat_sess.created_at.isoformat(),
        "updated_at": chat_sess.updated_at.isoformat(),
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "html_content": m.html_content,
                "created_at": m.created_at.isoformat()
            }
            for m in messages
        ]
    }

@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Patient = Depends(allow_patient)
):
    """Delete a chat session and all associated messages."""
    sess_stmt = select(ChatSession).where(
        ChatSession.id == session_id,
        ChatSession.patient_id == current_user.id
    )
    sess_res = await db.execute(sess_stmt)
    chat_sess = sess_res.scalars().first()
    if not chat_sess:
        raise HTTPException(status_code=404, detail="Chat session not found")

    await db.delete(chat_sess)
    await db.commit()
    return {"status": "deleted", "session_id": session_id}

