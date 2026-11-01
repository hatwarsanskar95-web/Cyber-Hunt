"""Synthetic browser-page fixture data for CYBER HUNT simulation.

All HTML content is entirely fabricated.  No real websites or organisations are represented.
External URL access is unconditionally blocked by the browser tool.
"""

from __future__ import annotations

from typing import Dict, Optional

# ---------------------------------------------------------------------------
# Local intranet pages keyed by slug / URL path
# ---------------------------------------------------------------------------

PAGES: Dict[str, Dict] = {
    "/": {
        "url": "https://intranet.synthcorp.example/",
        "slug": "/",
        "title": "SynthCorp Intranet — Home",
        "status_code": 200,
        "content_type": "text/html",
        "body": (
            "<html><head><title>SynthCorp Intranet</title></head><body>"
            "<h1>Welcome to SynthCorp Intranet</h1>"
            "<ul>"
            "<li><a href='/hr'>HR Portal</a></li>"
            "<li><a href='/finance'>Finance</a></li>"
            "<li><a href='/projects'>Projects</a></li>"
            "<li><a href='/it-support'>IT Support</a></li>"
            "</ul>"
            "</body></html>"
        ),
    },
    "/hr": {
        "url": "https://intranet.synthcorp.example/hr",
        "slug": "/hr",
        "title": "HR Portal",
        "status_code": 200,
        "content_type": "text/html",
        "body": (
            "<html><head><title>HR Portal</title></head><body>"
            "<h1>Human Resources Portal</h1>"
            "<p>Current headcount: 312 employees.</p>"
            "<p>Open roles: 4</p>"
            "<p>Next payroll run: 2026-11-28</p>"
            "</body></html>"
        ),
    },
    "/finance": {
        "url": "https://intranet.synthcorp.example/finance",
        "slug": "/finance",
        "title": "Finance Portal",
        "status_code": 200,
        "content_type": "text/html",
        "body": (
            "<html><head><title>Finance Portal</title></head><body>"
            "<h1>Finance</h1>"
            "<p>Q3 2026 EBITDA: \$2.4 M</p>"
            "<p>Annual budget utilisation: 68%%</p>"
            "<p>Approved vendors: PartnerCo Ltd., CloudHost Services, TechSupply Wholesale</p>"
            "</body></html>"
        ),
    },
    "/projects": {
        "url": "https://intranet.synthcorp.example/projects",
        "slug": "/projects",
        "title": "Projects",
        "status_code": 200,
        "content_type": "text/html",
        "body": (
            "<html><head><title>Projects</title></head><body>"
            "<h1>Active Projects</h1>"
            "<ul>"
            "<li>Project Nexus — Milestone 3 (Feature Freeze: 2026-11-10)</li>"
            "<li>Project Atlas — In progress</li>"
            "<li>Project Beacon — Planning</li>"
            "</ul>"
            "</body></html>"
        ),
    },
    "/it-support": {
        "url": "https://intranet.synthcorp.example/it-support",
        "slug": "/it-support",
        "title": "IT Support",
        "status_code": 200,
        "content_type": "text/html",
        "body": (
            "<html><head><title>IT Support</title></head><body>"
            "<h1>IT Support</h1>"
            "<p>Open tickets: 7</p>"
            "<p>Average resolution time: 4.2 hours</p>"
            "<p>Status page: All systems operational.</p>"
            "</body></html>"
        ),
    },
    "/password-reset": {
        "url": "https://intranet.synthcorp.example/password-reset",
        "slug": "/password-reset",
        "title": "Password Reset",
        "status_code": 200,
        "content_type": "text/html",
        "body": (
            "<html><head><title>Password Reset</title></head><body>"
            "<h1>Reset Your Password</h1>"
            "<p>Enter your current password and choose a new one.</p>"
            "<p>[FORM: current_password, new_password, confirm_password]</p>"
            "</body></html>"
        ),
    },
    "/security-policy": {
        "url": "https://intranet.synthcorp.example/security-policy",
        "slug": "/security-policy",
        "title": "Security Policy",
        "status_code": 200,
        "content_type": "text/html",
        "body": (
            "<html><head><title>Security Policy</title></head><body>"
            "<h1>Information Security Policy v4.2</h1>"
            "<p>All data transfers above \$500 require dual-authorisation.</p>"
            "<p>External email attachments must be scanned before opening.</p>"
            "<p>Credentials must never be shared via email or chat.</p>"
            "</body></html>"
        ),
    },
    "/not-found": {
        "url": "https://intranet.synthcorp.example/not-found",
        "slug": "/not-found",
        "title": "404 Not Found",
        "status_code": 404,
        "content_type": "text/html",
        "body": "<html><body><h1>404 — Page Not Found</h1></body></html>",
    },
}

# Allowed URL prefixes (anything else is blocked as external)
ALLOWED_PREFIXES = (
    "https://intranet.synthcorp.example",
    "http://intranet.synthcorp.example",
    "http://localhost",
    "https://localhost",
)


def get_page(url: str) -> Optional[Dict]:
    """Return the page dict for a given URL slug or None if not found."""
    # Strip allowed prefix, extract slug
    slug = url
    for prefix in ALLOWED_PREFIXES:
        if url.startswith(prefix):
            slug = url[len(prefix):]
            break
    # Normalise empty slug to "/"
    slug = slug.strip() or "/"
    # Strip query string
    slug = slug.split("?")[0]
    return PAGES.get(slug)


def is_external_url(url: str) -> bool:
    """Return True if the URL is external (not an allowed intranet prefix)."""
    return not any(url.startswith(p) for p in ALLOWED_PREFIXES)

