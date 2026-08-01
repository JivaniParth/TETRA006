from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.postgres import get_db
from app.models.all_models import Patient, Report
from app.models.schemas import ReportExtractionResponse, ReportConfirmRequest
from app.services.auth import get_current_user, RoleChecker
from app.services.report_ingestion import report_ingestion_service, check_ranges, calculate_severity_tier

router = APIRouter(prefix="/reports", tags=["Reports Ingestion"])
allow_patient = RoleChecker(["patient"])

@router.post("/upload", response_model=ReportExtractionResponse, status_code=status.HTTP_201_CREATED)
async def upload_report(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Patient = Depends(allow_patient)
):
    # Read file bytes
    file_bytes = await file.read()
    file_name = file.filename or "uploaded_report"
    file_type = file.content_type or "application/octet-stream"

    # Extract and process report
    report = await report_ingestion_service.extract_and_process(
        db=db,
        patient_id=str(current_user.id),
        file_bytes=file_bytes,
        file_name=file_name,
        file_type=file_type
    )

    return {
        "report_id": str(report.id),
        "file_name": report.file_name,
        "extracted_values": report.extracted_values,
        "confidence": report.confidence,
        "range_check_passed": report.range_check_passed,
        "status": report.status,
        "severity_tier": report.severity_tier
    }

@router.post("/{report_id}/confirm", response_model=ReportExtractionResponse)
async def confirm_report(
    report_id: str,
    payload: ReportConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Patient = Depends(allow_patient)
):
    # Query report
    query = select(Report).where(Report.id == report_id)
    res = await db.execute(query)
    report = res.scalars().first()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found."
        )

    if str(report.patient_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: This report belongs to another patient."
        )

    if report.status in ["auto_saved", "confirmed", "corrected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Report status is already '{report.status}' and cannot be confirmed again."
        )

    if payload.confirm:
        if payload.corrected_values:
            report.extracted_values = payload.corrected_values
            report.status = "corrected"
        else:
            report.status = "confirmed"

        # Update clinical parameters
        report.range_check_passed = check_ranges(report.extracted_values)
        report.severity_tier = calculate_severity_tier(report.extracted_values)

        # Commit vitals to history and index to Qdrant
        await report_ingestion_service.commit_vitals_and_indexing(db, report)
    else:
        # Rejected by patient
        report.status = "rejected"

    await db.commit()
    await db.refresh(report)

    return {
        "report_id": str(report.id),
        "file_name": report.file_name,
        "extracted_values": report.extracted_values,
        "confidence": report.confidence,
        "range_check_passed": report.range_check_passed,
        "status": report.status,
        "severity_tier": report.severity_tier
    }
