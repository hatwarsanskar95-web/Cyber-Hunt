"""FastAPI Endpoints for Level 1-4 PDF Security Reports.

Phase 5 Implementation:
- GET  /api/v1/reports                     List all generated security reports
- GET  /api/v1/reports/{report_id}/download Download PDF security report
- POST /api/v1/reports/generate            Generate PDF security report from analysis data
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel, Field

from app.schemas.common import SuccessResponse
from app.security.report_generator import (
    generate_security_pdf_report,
    get_report_bytes,
    list_generated_reports,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["Security Reports"])


class GenerateReportRequest(BaseModel):
    analysis_data: Dict[str, Any] = Field(..., description="Complete security analysis data dictionary")


@router.get("", response_model=SuccessResponse, summary="List all generated security audit reports")
async def get_all_reports(
    security_level: Optional[str] = Query(default=None, description="Optional level filter: email | file | browser | payment"),
) -> SuccessResponse:
    """Return all historical generated PDF security reports."""
    reports = list_generated_reports(security_level)
    return SuccessResponse(status="success", data={"reports": reports, "count": len(reports)})


@router.get("/{report_id}/download", summary="Download official PDF security report")
async def download_report_pdf(report_id: str) -> Response:
    """Download a generated PDF security report."""
    pdf_bytes = get_report_bytes(report_id)
    if not pdf_bytes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report '{report_id}' not found. Make sure the analysis has been completed.",
        )

    filename = f"{report_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.post("/generate", response_model=SuccessResponse, summary="Generate a downloadable PDF security report")
async def generate_report_endpoint(payload: GenerateReportRequest) -> SuccessResponse:
    """Generate a downloadable PDF report for a completed security analysis."""
    try:
        report_record = generate_security_pdf_report(payload.analysis_data)
        return SuccessResponse(status="success", data=report_record)
    except Exception as exc:
        log.error("Failed to generate PDF report: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report generation error: {exc}",
        )

