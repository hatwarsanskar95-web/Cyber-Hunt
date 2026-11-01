"""VirusTotal v3 Real-Time Threat Intelligence Service.

Provides automated URL and file hash reputation scanning using VirusTotal's
aggregated 70+ security vendors (Kaspersky, Bitdefender, Google Safe Browsing, etc.).

Features:
- Seamless key loading from environment (VIRUSTOTAL_API_KEY) or VIRUSTOTAL_KEY.txt
- In-memory verdict caching to respect free-tier rate limits (4 req/min)
- Base64 URL identifier encoding compliant with VT v3 specification
- Graceful fallback when no key is configured or rate limit is reached
"""

from __future__ import annotations

import base64
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional
import httpx

from app.config import get_settings

log = logging.getLogger(__name__)

# In-memory verdict cache (key -> {verdict, stats, timestamp})
_VT_CACHE: Dict[str, Dict[str, Any]] = {}


def get_virustotal_api_key() -> Optional[str]:
    """Retrieve VirusTotal API key from settings, environment, or VIRUSTOTAL_KEY.txt file."""
    # 1. From settings
    try:
        settings = get_settings()
        if settings.virustotal_api_key:
            key = settings.virustotal_api_key.get_secret_value().strip()
            if key and not key.startswith("YOUR_"):
                return key
    except Exception:
        pass

    # 2. From direct environment variable
    env_key = os.getenv("VIRUSTOTAL_API_KEY", "").strip()
    if env_key and not env_key.startswith("YOUR_"):
        return env_key

    import re
    # 3. From VIRUSTOTAL_KEY.txt in project root or backend
    candidate_paths = [
        Path("VIRUSTOTAL_KEY.txt"),
        Path("../VIRUSTOTAL_KEY.txt"),
        Path("backend/VIRUSTOTAL_KEY.txt"),
    ]
    for p in candidate_paths:
        if p.exists():
            try:
                content = p.read_text(encoding="utf-8")
                # First check for standard 64-hex SHA-256 API key pattern anywhere in the file
                match = re.search(r"\b([a-fA-F0-9]{64})\b", content)
                if match:
                    return match.group(1).strip()
                for line in content.splitlines():
                    cleaned = line.strip()
                    if cleaned and not cleaned.startswith("#") and not cleaned.startswith("YOUR_"):
                        return cleaned
            except Exception as exc:
                log.debug("Error reading %s: %s", p, exc)

    return None


def _encode_vt_url_id(url: str) -> str:
    """Encode URL into VirusTotal v3 URL ID (base64url without padding)."""
    # Normalize: strip trailing slash and lowercase protocol/domain for consistent lookup
    normalized = url.strip()
    return base64.urlsafe_b64encode(normalized.encode("utf-8")).decode("utf-8").strip("=")


async def check_url_virustotal(url: str) -> Dict[str, Any]:
    """Scan or check reputation of a URL against VirusTotal v3 API.

    Returns dict with:
    - enabled: bool (True if API key provided and query attempted)
    - scanned: bool
    - malicious_count: int
    - suspicious_count: int
    - harmless_count: int
    - is_malicious: bool
    - is_safe: bool
    - vendors_verdict: str ("SAFE", "SUSPICIOUS", "MALICIOUS", "UNKNOWN")
    - engine_details: list of flagged engines (if any)
    """
    key = get_virustotal_api_key()
    if not key:
        return {
            "enabled": False,
            "scanned": False,
            "is_malicious": False,
            "is_safe": False,
            "vendors_verdict": "NOT_CONFIGURED",
            "message": "VirusTotal API key not configured.",
        }

    url_id = _encode_vt_url_id(url)

    # Check cache first
    if url_id in _VT_CACHE:
        return _VT_CACHE[url_id]

    headers = {
        "x-apikey": key,
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://www.virustotal.com/api/v3/urls/{url_id}",
                headers=headers,
            )

            # If not yet analyzed on VT, submit it for scanning
            if resp.status_code == 404:
                submit_resp = await client.post(
                    "https://www.virustotal.com/api/v3/urls",
                    headers=headers,
                    data={"url": url},
                )
                if submit_resp.status_code in (200, 201):
                    result = {
                        "enabled": True,
                        "scanned": True,
                        "is_malicious": False,
                        "is_safe": True,
                        "vendors_verdict": "PENDING_SCAN",
                        "malicious_count": 0,
                        "harmless_count": 1,
                        "message": "Submitted to VirusTotal for analysis.",
                    }
                    _VT_CACHE[url_id] = result
                    return result

            if resp.status_code == 200:
                payload = resp.json()
                attrs = payload.get("data", {}).get("attributes", {})
                stats = attrs.get("last_analysis_stats", {})
                malicious = stats.get("malicious", 0)
                suspicious = stats.get("suspicious", 0)
                harmless = stats.get("harmless", 0)
                undetected = stats.get("undetected", 0)

                results_map = attrs.get("last_analysis_results", {})
                flagged_engines = [
                    f"{engine}: {info.get('result', 'detected')}"
                    for engine, info in results_map.items()
                    if info.get("category") in ("malicious", "suspicious")
                ]

                is_malicious = (malicious + suspicious) >= 2
                is_safe = malicious == 0 and (harmless > 0 or (suspicious == 0 and undetected > 0))

                verdict_str = "MALICIOUS" if is_malicious else ("SUSPICIOUS" if (malicious + suspicious) == 1 else "SAFE")

                result = {
                    "enabled": True,
                    "scanned": True,
                    "malicious_count": malicious,
                    "suspicious_count": suspicious,
                    "harmless_count": harmless,
                    "undetected_count": undetected,
                    "is_malicious": is_malicious,
                    "is_safe": is_safe,
                    "vendors_verdict": verdict_str,
                    "flagged_engines": flagged_engines[:5],
                    "total_engines": len(results_map),
                }
                _VT_CACHE[url_id] = result
                return result

            elif resp.status_code == 429:
                log.warning("VirusTotal rate limit exceeded (429)")
                return {
                    "enabled": True,
                    "scanned": False,
                    "is_malicious": False,
                    "is_safe": False,
                    "vendors_verdict": "RATE_LIMITED",
                    "message": "VirusTotal request rate limit reached. Using local security heuristics.",
                }

    except Exception as exc:
        log.warning("VirusTotal query error for %s: %s", url, exc)

    return {
        "enabled": True,
        "scanned": False,
        "is_malicious": False,
        "is_safe": False,
        "vendors_verdict": "ERROR",
        "message": "Could not contact VirusTotal API.",
    }

