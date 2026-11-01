"""Sensitive Data & PII Scanner using Microsoft Presidio Analyzer.

Implements SEC-005:
- Integrates Presidio AnalyzerEngine with custom recognizers for API keys, bearer tokens, etc.
- Detects synthetic PII (Email addresses, US SSNs, API Keys, Credentials).
- Returns structured PresidioFinding objects with entity type, confidence, start/end.
- Masks sensitive values in logs.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Structured Findings Model
# ---------------------------------------------------------------------------


class PresidioFinding(BaseModel):
    """Structured PII detection finding."""

    entity_type: str = Field(description="Detected entity category (e.g. EMAIL_ADDRESS, US_SSN, API_KEY)")
    confidence: float = Field(ge=0.0, le=1.0, description="Detection confidence score")
    start: int = Field(ge=0, description="Start character index in scanned text")
    end: int = Field(ge=0, description="End character index in scanned text")
    text_snippet: Optional[str] = Field(default=None, description="Redacted or masked representation of finding")


class PresidioScanResult(BaseModel):
    """Aggregated scan outcome for OPA context injection."""

    has_pii: bool = Field(default=False, description="True if any sensitive entity exceeds confidence threshold")
    findings: List[PresidioFinding] = Field(default_factory=list, description="List of detected sensitive entities")
    entity_counts: Dict[str, int] = Field(default_factory=dict, description="Count of occurrences by entity type")


# ---------------------------------------------------------------------------
# Presidio Scanner Implementation
# ---------------------------------------------------------------------------

_API_KEY_PATTERNS = [
    # Generic API Keys / Secrets (sk-..., secret_..., api_key_...)
    re.compile(r"(?i)\b(?:sk|api|key|token|secret)[-_][a-zA-Z0-9_\-]{16,64}\b"),
    # AWS Access Key ID format (AKIA...)
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    # JWT Bearer tokens
    re.compile(r"\beyJ[a-zA-Z0-9_\-]{10,}\.eyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\b"),
]

# Regex fallback for offline / fast scanning
_EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
_SSN_PATTERN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")


class PresidioScanner:
    """Scanner combining Presidio AnalyzerEngine with custom security recognizers."""

    def __init__(self, confidence_threshold: float = 0.5):
        self.confidence_threshold = confidence_threshold
        self._analyzer = None
        self._init_analyzer()

    def _init_analyzer(self) -> None:
        """Initialize Presidio AnalyzerEngine safely with spacy en_core_web_sm."""
        try:
            from presidio_analyzer import AnalyzerEngine, Pattern, PatternRecognizer
            from presidio_analyzer.nlp_engine import NlpEngineProvider

            nlp_config = {
                "nlp_engine_name": "spacy",
                "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
            }
            provider = NlpEngineProvider(nlp_configuration=nlp_config)
            nlp_engine = provider.create_engine()
            self._analyzer = AnalyzerEngine(nlp_engine=nlp_engine)

            # Register custom API Key recognizer in Presidio
            api_patterns = [
                Pattern(name="api_key_pattern", regex=r"(?i)\b(?:sk|api|key|token|secret)[-_][a-zA-Z0-9_\-]{16,64}\b", score=0.85),
                Pattern(name="aws_key_pattern", regex=r"\bAKIA[0-9A-Z]{16}\b", score=0.95),
            ]
            api_recognizer = PatternRecognizer(
                supported_entity="API_KEY",
                patterns=api_patterns,
                name="CustomApiKeyRecognizer",
            )
            self._analyzer.registry.add_recognizer(api_recognizer)
            log.info("Presidio AnalyzerEngine initialized with custom security recognizers")
        except Exception as exc:
            log.warning("Could not initialize full Presidio AnalyzerEngine (%s); using regex security scanner fallback", exc)
            self._analyzer = None

    def scan_text(self, text: str) -> PresidioScanResult:
        """Scan a single text string for sensitive PII and API keys."""
        if not text or not isinstance(text, str) or not text.strip():
            return PresidioScanResult(has_pii=False, findings=[], entity_counts={})

        findings: List[PresidioFinding] = []

        # 1. Custom Regex for API Keys & Tokens (always runs)
        for pattern in _API_KEY_PATTERNS:
            for match in pattern.finditer(text):
                matched_val = match.group()
                masked = f"{matched_val[:3]}...{matched_val[-3:]}" if len(matched_val) > 6 else "***"
                findings.append(
                    PresidioFinding(
                        entity_type="API_KEY",
                        confidence=0.90,
                        start=match.start(),
                        end=match.end(),
                        text_snippet=masked,
                    )
                )

        # 2. Presidio AnalyzerEngine if available
        if self._analyzer is not None:
            try:
                results = self._analyzer.analyze(
                    text=text,
                    language="en",
                    entities=["EMAIL_ADDRESS", "US_SSN", "PHONE_NUMBER", "CREDIT_CARD", "API_KEY"],
                    score_threshold=self.confidence_threshold,
                )
                for r in results:
                    # Avoid duplicate API_KEY if already caught by custom regex
                    if r.entity_type == "API_KEY":
                        already_found = any(f.entity_type == "API_KEY" and abs(f.start - r.start) < 2 for f in findings)
                        if already_found:
                            continue

                    raw_snippet = text[r.start : r.end]
                    masked = f"{raw_snippet[:2]}***{raw_snippet[-2:]}" if len(raw_snippet) > 4 else "***"
                    findings.append(
                        PresidioFinding(
                            entity_type=r.entity_type,
                            confidence=float(r.score),
                            start=r.start,
                            end=r.end,
                            text_snippet=masked,
                        )
                    )
            except Exception as e:
                log.warning("Presidio analyze error (%s); applying regex fallback", e)
                self._apply_regex_fallbacks(text, findings)

        # Always run regex fallbacks to guarantee synthetic test patterns (SSN, Email) are captured
        self._apply_regex_fallbacks(text, findings)

        # Build aggregated result
        entity_counts: Dict[str, int] = {}
        for f in findings:
            entity_counts[f.entity_type] = entity_counts.get(f.entity_type, 0) + 1

        has_pii = len(findings) > 0
        return PresidioScanResult(
            has_pii=has_pii,
            findings=findings,
            entity_counts=entity_counts,
        )

    def _apply_regex_fallbacks(self, text: str, findings: List[PresidioFinding]) -> None:
        """Regex-based fallback for Email and SSN detection."""
        for match in _EMAIL_PATTERN.finditer(text):
            already_found = any(f.entity_type == "EMAIL_ADDRESS" and f.start == match.start() for f in findings)
            if not already_found:
                matched_val = match.group()
                masked = f"{matched_val[:2]}***@{matched_val.split('@')[-1]}"
                findings.append(
                    PresidioFinding(
                        entity_type="EMAIL_ADDRESS",
                        confidence=0.85,
                        start=match.start(),
                        end=match.end(),
                        text_snippet=masked,
                    )
                )

        for match in _SSN_PATTERN.finditer(text):
            already_found = any(f.entity_type == "US_SSN" and f.start == match.start() for f in findings)
            if not already_found:
                findings.append(
                    PresidioFinding(
                        entity_type="US_SSN",
                        confidence=0.90,
                        start=match.start(),
                        end=match.end(),
                        text_snippet="***-**-****",
                    )
                )

    def scan_dict(self, data: Dict[str, Any]) -> PresidioScanResult:
        """Recursively scan values in a dictionary (e.g. tool parameters)."""
        all_findings: List[PresidioFinding] = []
        entity_counts: Dict[str, int] = {}

        def _traverse(val: Any) -> None:
            if isinstance(val, str):
                res = self.scan_text(val)
                for f in res.findings:
                    all_findings.append(f)
                    entity_counts[f.entity_type] = entity_counts.get(f.entity_type, 0) + 1
            elif isinstance(val, dict):
                for v in val.values():
                    _traverse(v)
            elif isinstance(val, list):
                for item in val:
                    _traverse(item)

        _traverse(data)

        return PresidioScanResult(
            has_pii=len(all_findings) > 0,
            findings=all_findings,
            entity_counts=entity_counts,
        )


# Singleton instance accessor
_scanner_instance: Optional[PresidioScanner] = None


def get_presidio_scanner() -> PresidioScanner:
    """Return or initialize singleton PresidioScanner."""
    global _scanner_instance
    if _scanner_instance is None:
        _scanner_instance = PresidioScanner()
    return _scanner_instance
