"""CYBER HUNT — Automated Multi-Agent PDF Security Report Generator.

Generates official, downloadable PDF security audit reports adhering strictly to
Phase 5 requirements:
- CYBER HUNT Branding & Styling
- Unique Report ID (RPT-XXXX-XXXX)
- Timestamp & Security Level
- Grounded Risk & Confidence Scores
- OPA Decision (ALLOW, BLOCK, REQUIRE APPROVAL)
- Threat Indicators & Evidence Grounding
- Red Team, Target AI, Blue Team, and OPA Pipeline Breakdown
- Remediation Guidance & Corrective Actions
"""

from __future__ import annotations

import io
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

log = logging.getLogger(__name__)

# Directory where generated PDF reports are stored
REPORTS_DIR = Path("backend/reports")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# In-memory registry of generated reports: report_id -> metadata + file_path
_REPORT_REGISTRY: Dict[str, Dict[str, Any]] = {}


def generate_security_pdf_report(analysis_data: Dict[str, Any]) -> Dict[str, Any]:
    """Generate and persist a professional PDF security report for any security level."""
    report_id = analysis_data.get("report_id") or f"RPT-{uuid.uuid4().hex[:8].upper()}"
    security_level = str(analysis_data.get("security_level", "system")).lower()
    item_name = analysis_data.get("item_name") or analysis_data.get("subject") or analysis_data.get("filename") or analysis_data.get("url") or "Security Evaluation Target"
    date_time_str = analysis_data.get("date_time") or analysis_data.get("timestamp") or datetime.now(timezone.utc).isoformat()
    decision = str(analysis_data.get("decision", "BLOCK")).upper()
    risk_score = analysis_data.get("risk_score", 0)
    confidence_score = analysis_data.get("confidence_score", 95)
    classification = analysis_data.get("threat_classification") or ("Safe" if decision == "ALLOW" else "Suspicious")
    indicators: List[str] = analysis_data.get("threat_indicators") or []
    evidence: List[str] = analysis_data.get("evidence") or []
    explanation = analysis_data.get("explanation") or "Automated multi-agent security pipeline analysis completed."
    checks = analysis_data.get("checks_completed") or [
        "Adversarial Payload & Threat Signature Inspection",
        "Target AI Intent & Tool Proposal Validation",
        "Blue Team Guardian & Heuristic Scan",
        "Open Policy Agent (OPA) Guardrail Enforcement",
    ]
    target_findings = analysis_data.get("target_ai_finding") or "No adversarial execution requested."
    blue_findings = analysis_data.get("blue_team_verification") or "Analysis completed with verified policy bounds."
    opa_reason = analysis_data.get("opa_policy_reason") or "Enforced by Open Policy Agent baseline."
    remediation = analysis_data.get("remediation") or "Follow standard operational protocols."

    # Format timestamp nicely
    try:
        dt = datetime.fromisoformat(date_time_str.replace("Z", "+00:00"))
        formatted_date = dt.strftime("%B %d, %Y - %I:%M:%S %p UTC")
    except Exception:
        formatted_date = date_time_str

    pdf_filename = f"{report_id}.pdf"
    pdf_path = REPORTS_DIR / pdf_filename

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    brand_style = ParagraphStyle(
        "BrandHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#7c3aed"),
    )
    subtitle_style = ParagraphStyle(
        "SubTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#94a3b8"),
    )
    section_h2 = ParagraphStyle(
        "SectionH2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=8,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "BodyText",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155"),
    )
    bold_body = ParagraphStyle(
        "BoldBody",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#0f172a"),
    )

    story = []

    # 1. Branding Header
    story.append(Paragraph("CYBER HUNT", brand_style))
    story.append(Paragraph("Autonomous Multi-Agent Cyber Warfare & Threat Defense Platform", subtitle_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#7c3aed"), spaceAfter=12))

    # 2. Decision Banner
    if decision == "ALLOW":
        banner_bg = colors.HexColor("#dcfce7")
        banner_border = colors.HexColor("#16a34a")
        banner_text_color = "#15803d"
        banner_title = "SECURITY STATUS: ALLOWED / CLEAN"
        banner_sub = "Zero credible threat indicators detected. Action verified safe through authorized policy."
    elif decision == "REQUIRE_APPROVAL":
        banner_bg = colors.HexColor("#fef3c7")
        banner_border = colors.HexColor("#d97706")
        banner_text_color = "#b45309"
        banner_title = "SECURITY STATUS: REQUIRES OPERATOR APPROVAL"
        banner_sub = "Uncertain or conflicting security markers identified. Awaiting explicit operator command sign-off."
    else:
        banner_bg = colors.HexColor("#fee2e2")
        banner_border = colors.HexColor("#dc2626")
        banner_text_color = "#b91c1c"
        banner_title = "SECURITY STATUS: BLOCKED / THREAT INTERCEPTED"
        banner_sub = "Critical adversarial vector identified. Action blocked automatically by OPA Policy Engine."

    banner_data = [
        [
            Paragraph(f"<font color='{banner_text_color}'><b>{banner_title}</b></font>", ParagraphStyle("BTitle", fontName="Helvetica-Bold", fontSize=13, leading=16)),
        ],
        [
            Paragraph(f"<font color='{banner_text_color}'>{banner_sub}</font>", ParagraphStyle("BSub", fontName="Helvetica", fontSize=9, leading=12)),
        ]
    ]
    banner_table = Table(banner_data, colWidths=[540])
    banner_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), banner_bg),
        ("BOX", (0, 0), (-1, -1), 1.5, banner_border),
        ("PADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
    ]))
    story.append(banner_table)
    story.append(Spacer(1, 12))

    # 3. Audit Metadata Grid
    meta_table_data = [
        [
            Paragraph("<b>Report Identifier:</b>", bold_body),
            Paragraph(f"<font name='Courier'>{report_id}</font>", body_style),
            Paragraph("<b>Security Level:</b>", bold_body),
            Paragraph(f"Level {1 if security_level == 'email' else 2 if security_level == 'file' else 3 if security_level == 'browser' else 4}: {security_level.capitalize()} Security", body_style),
        ],
        [
            Paragraph("<b>Analyzed Target:</b>", bold_body),
            Paragraph(item_name[:40], body_style),
            Paragraph("<b>Timestamp:</b>", bold_body),
            Paragraph(formatted_date, body_style),
        ],
        [
            Paragraph("<b>Risk Score:</b>", bold_body),
            Paragraph(f"<b>{risk_score} / 100</b> ({classification})", body_style),
            Paragraph("<b>Model Confidence:</b>", bold_body),
            Paragraph(f"<b>{confidence_score}%</b> verified", body_style),
        ],
    ]
    meta_table = Table(meta_table_data, colWidths=[110, 160, 110, 160])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # 4. Threats & Suspicious Indicators Found
    story.append(Paragraph("1. Threat Classification & Indicators Detected", section_h2))
    if indicators:
        ind_rows = [[Paragraph("<b>#</b>", bold_body), Paragraph("<b>Security Indicator Code</b>", bold_body)]]
        for idx, ind in enumerate(indicators, 1):
            ind_rows.append([
                Paragraph(str(idx), body_style),
                Paragraph(f"<font color='#b91c1c'><b>{ind}</b></font>", body_style),
            ])
        ind_table = Table(ind_rows, colWidths=[30, 510])
        ind_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(ind_table)
    else:
        story.append(Paragraph("<i>No suspicious indicators or adversarial signatures detected. The item passed all threat heuristics.</i>", body_style))
    story.append(Spacer(1, 10))

    # 5. Evidence & Forensic Breakdown
    story.append(Paragraph("2. Forensic Findings & Evidence", section_h2))
    if evidence:
        ev_rows = [[Paragraph("<b>Evidence Item</b>", bold_body)]]
        for ev in evidence:
            ev_rows.append([Paragraph(f"• {ev}", body_style)])
        ev_table = Table(ev_rows, colWidths=[540])
        ev_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("PADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(ev_table)
    else:
        story.append(Paragraph("<i>Clean telemetry verified. Sender, content, syntax, and payload match standard legitimate activity.</i>", body_style))
    story.append(Spacer(1, 10))

    # 6. Multi-Agent Pipeline Verification
    story.append(Paragraph("3. Multi-Agent Pipeline Verification", section_h2))
    agent_data = [
        [Paragraph("<b>Pipeline Stage</b>", bold_body), Paragraph("<b>Evaluation Summary & Findings</b>", bold_body)],
        [Paragraph("<b>Target AI Analysis</b>", bold_body), Paragraph(target_findings, body_style)],
        [Paragraph("<b>Blue Team Guardian</b>", bold_body), Paragraph(blue_findings, body_style)],
        [Paragraph("<b>OPA Policy Engine</b>", bold_body), Paragraph(opa_reason, body_style)],
    ]
    agent_table = Table(agent_data, colWidths=[140, 400])
    agent_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(agent_table)
    story.append(Spacer(1, 10))

    # 7. Completed Security Checks & Rationale
    story.append(Paragraph("4. Completed Security Checks & Rationale", section_h2))
    checks_str = ", ".join(checks) if isinstance(checks, list) else str(checks)
    story.append(Paragraph(f"<b>Security Checks Performed:</b> {checks_str}", body_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"<b>Enforcement Rationale:</b> {explanation}", body_style))
    story.append(Spacer(1, 10))

    # 8. Recommended Remediation & Next Actions
    story.append(Paragraph("5. Recommended Remediation & Operator Guidance", section_h2))
    story.append(Paragraph(f"<b>Remediation Action:</b> {remediation}", body_style))
    story.append(Spacer(1, 14))

    # Footer note
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#94a3b8"), spaceAfter=6))
    footer_text = (
        f"CYBER HUNT Security Telemetry • Confidential Audit Document • Report ID: {report_id} • "
        f"Generated automatically at {formatted_date}"
    )
    story.append(Paragraph(f"<font color='#64748b' size='7'>{footer_text}</font>", ParagraphStyle("Footer", fontName="Helvetica", fontSize=7, leading=9)))

    # Build PDF
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    # Save to disk
    pdf_path.write_bytes(pdf_bytes)
    log.info("Generated security report PDF: %s (%d bytes)", pdf_path.name, len(pdf_bytes))

    record = {
        "report_id": report_id,
        "security_level": security_level,
        "item_name": item_name,
        "decision": decision,
        "risk_score": risk_score,
        "confidence_score": confidence_score,
        "date_time": date_time_str,
        "pdf_path": str(pdf_path.resolve()),
        "pdf_filename": pdf_filename,
        "download_url": f"/api/v1/reports/{report_id}/download",
        "analysis_data": analysis_data,
    }
    _REPORT_REGISTRY[report_id] = record
    return record


def get_report_bytes(report_id: str) -> Optional[bytes]:
    """Retrieve raw PDF bytes by report ID."""
    rec = _REPORT_REGISTRY.get(report_id)
    if rec and "pdf_path" in rec:
        p = Path(rec["pdf_path"])
        if p.exists():
            return p.read_bytes()
    # Check directly in reports directory
    direct_p = REPORTS_DIR / f"{report_id}.pdf"
    if direct_p.exists():
        return direct_p.read_bytes()
    return None


def list_generated_reports(security_level: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return list of all generated reports."""
    items = list(_REPORT_REGISTRY.values())
    if security_level:
        items = [r for r in items if r.get("security_level") == security_level.lower()]
    items.sort(key=lambda r: r.get("date_time", ""), reverse=True)
    return items

