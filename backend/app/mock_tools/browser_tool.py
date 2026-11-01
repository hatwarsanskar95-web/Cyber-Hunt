"""Mock Browser Tool — TOOL-004.

Simulates browser/web operations against local HTML fixture pages.
External URLs are unconditionally blocked — no real HTTP requests are made.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

from fixtures.pages import PAGES, get_page, is_external_url

log = logging.getLogger(__name__)

SUPPORTED_OPERATIONS = frozenset(
    {"fetch_page", "navigate", "search", "read_page", "browse_url"}
)

_FETCH_ALIASES = {"navigate", "read_page", "browse_url", "fetch_page"}


def fetch_page(params: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch a simulated intranet page by URL.  External URLs are blocked."""
    url = str(params.get("url", "")).strip()
    if not url:
        return {"operation": "fetch_page", "error": "url parameter is required"}

    if is_external_url(url):
        log.warning("fetch_page BLOCKED external URL: %r", url)
        return {
            "operation": "fetch_page",
            "url": url,
            "status_code": 403,
            "error": (
                "[SIMULATION SECURITY] External URL access is unconditionally blocked. "
                "Only synthetic intranet pages are accessible."
            ),
        }

    page = get_page(url)
    if page is None:
        log.info("fetch_page: URL=%r → 404", url)
        not_found = PAGES.get("/not-found", {})
        return {
            "operation": "fetch_page",
            "url": url,
            "status_code": 404,
            "title": "404 Not Found",
            "body": not_found.get("body", "<html><body>Not Found</body></html>"),
        }

    log.info("fetch_page: URL=%r → %d", url, page["status_code"])
    return {
        "operation": "fetch_page",
        "url": page["url"],
        "title": page["title"],
        "status_code": page["status_code"],
        "content_type": page["content_type"],
        "body": page["body"],
    }


def search(params: Dict[str, Any]) -> Dict[str, Any]:
    """Search across all synthetic intranet pages for a keyword."""
    query = str(params.get("query", "")).lower().strip()
    if not query:
        return {"operation": "search", "error": "query parameter is required"}

    results = []
    for slug, page in PAGES.items():
        if slug == "/not-found":
            continue
        body_lower = page["body"].lower()
        title_lower = page["title"].lower()
        if query in body_lower or query in title_lower:
            results.append({
                "url": page["url"],
                "title": page["title"],
                "excerpt": _extract_excerpt(page["body"], query),
            })

    log.info("browser search: query=%r hits=%d", query, len(results))
    return {
        "operation": "search",
        "query": query,
        "count": len(results),
        "results": results,
        "note": "[SIMULATION] Results are from synthetic intranet only. No external web access.",
    }


def execute(operation: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """Dispatch a browser tool operation."""
    if operation not in SUPPORTED_OPERATIONS:
        return {
            "operation": operation,
            "error": f"Unsupported browser operation: {operation!r}. "
                     f"Supported: {sorted(SUPPORTED_OPERATIONS)}",
        }
    if operation in _FETCH_ALIASES:
        return fetch_page(params)
    if operation == "search":
        return search(params)
    return {"operation": operation, "error": "Handler not found"}


def _extract_excerpt(body: str, query: str, context: int = 80) -> str:
    """Return a short excerpt around the first occurrence of query."""
    idx = body.lower().find(query)
    if idx == -1:
        return body[:context]
    start = max(0, idx - 30)
    end = min(len(body), idx + context)
    excerpt = body[start:end].replace("\n", " ")
    return f"...{excerpt}..."

