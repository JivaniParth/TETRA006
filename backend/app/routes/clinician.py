from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.models.all_models import ClinicianEscalation
from app.models.schemas import EscalationResponse
from app.services.auth import RoleChecker

router = APIRouter(prefix="/clinician", tags=["Clinician Dashboard"])
allow_clinician = RoleChecker(["clinician"])

@router.get("/escalations", response_model=List[EscalationResponse])
async def get_escalations(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(allow_clinician)
):
    query = select(ClinicianEscalation).order_by(ClinicianEscalation.created_at.desc())
    res = await db.execute(query)
    escalations = res.scalars().all()
    return list(escalations)

@router.post("/escalations/{id}/resolve")
async def resolve_escalation(
    id: str,
    comments: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(allow_clinician)
):
    query = select(ClinicianEscalation).where(ClinicianEscalation.id == id)
    res = await db.execute(query)
    escalation = res.scalars().first()
    
    if not escalation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Escalation not found."
        )
        
    import datetime
    escalation.status = "resolved"
    escalation.resolved_at = datetime.datetime.utcnow()
    escalation.comments = comments
    
    await db.commit()
    return {"message": "Escalation resolved successfully."}
