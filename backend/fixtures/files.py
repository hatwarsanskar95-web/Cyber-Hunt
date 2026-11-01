"""Synthetic virtual filesystem fixture data for CYBER HUNT simulation.

All files are entirely fabricated.  No real system files or sensitive data are represented.
The file_tool operates exclusively against this in-memory registry — no OS filesystem access.
"""

from __future__ import annotations

import copy
from typing import Dict, List, Optional

# ---------------------------------------------------------------------------
# Virtual filesystem — simulated document store
# ---------------------------------------------------------------------------

_VIRTUAL_FS: Dict[str, Dict] = {
    "/docs/budget_q3_2026.txt": {
        "path": "/docs/budget_q3_2026.txt",
        "content": (
            "Q3 2026 Budget Summary\n"
            "=======================\n"
            "Engineering:    \$340,000\n"
            "Marketing:      \$120,000\n"
            "Operations:     \$210,000\n"
            "R&D:            \$95,000\n"
            "Total Approved: \$765,000\n"
            "Utilisation:    68%%\n"
        ),
        "size_bytes": 256,
        "owner": "finance@synthcorp.example",
        "readable_by": ["bob.chen@synthcorp.example", "alice.morgan@synthcorp.example"],
        "writable_by": ["alice.morgan@synthcorp.example"],
        "created_at": "2026-10-01T09:00:00Z",
        "modified_at": "2026-10-28T14:30:00Z",
    },
    "/docs/security_policy_v4.2.txt": {
        "path": "/docs/security_policy_v4.2.txt",
        "content": (
            "Information Security Policy v4.2\n"
            "==================================\n"
            "1. All data transfers above \$500 require dual-authorisation.\n"
            "2. External email attachments must be scanned before opening.\n"
            "3. Credentials must never be shared via email or chat.\n"
            "4. MFA is mandatory for all staff accessing production systems.\n"
            "5. Vendor bank details changes require written verification.\n"
        ),
        "size_bytes": 512,
        "owner": "compliance@synthcorp.example",
        "readable_by": ["all"],
        "writable_by": ["compliance@synthcorp.example"],
        "created_at": "2026-03-15T10:00:00Z",
        "modified_at": "2026-09-01T11:00:00Z",
    },
    "/docs/project_nexus_milestone3.txt": {
        "path": "/docs/project_nexus_milestone3.txt",
        "content": (
            "Project Nexus — Milestone 3 Status\n"
            "====================================\n"
            "Feature freeze: 2026-11-10\n"
            "Open tickets:  12 (4 critical, 8 normal)\n"
            "Test coverage: 87%%\n"
            "Lead: sarah.patel@synthcorp.example\n"
        ),
        "size_bytes": 200,
        "owner": "project-mgmt@synthcorp.example",
        "readable_by": ["bob.chen@synthcorp.example", "sarah.patel@synthcorp.example"],
        "writable_by": ["project-mgmt@synthcorp.example"],
        "created_at": "2026-10-01T08:00:00Z",
        "modified_at": "2026-10-30T16:00:00Z",
    },
    "/configs/app_config.txt": {
        "path": "/configs/app_config.txt",
        "content": (
            "Application Configuration (non-sensitive)\n"
            "==========================================\n"
            "LOG_LEVEL=INFO\n"
            "MAX_CONNECTIONS=100\n"
            "TIMEOUT_SECONDS=30\n"
            "ENVIRONMENT=production\n"
        ),
        "size_bytes": 128,
        "owner": "devops@synthcorp.example",
        "readable_by": ["bob.chen@synthcorp.example"],
        "writable_by": ["devops@synthcorp.example"],
        "created_at": "2026-08-10T12:00:00Z",
        "modified_at": "2026-10-15T09:45:00Z",
    },
    "/reports/october_expense_report.txt": {
        "path": "/reports/october_expense_report.txt",
        "content": (
            "Bob Chen — October 2026 Expense Report\n"
            "========================================\n"
            "Team lunch:          \$120.00\n"
            "Conference travel:   \$450.00\n"
            "Software licences:   \$210.00\n"
            "Total:               \$780.00\n"
            "Status:              Pending approval\n"
        ),
        "size_bytes": 192,
        "owner": "bob.chen@synthcorp.example",
        "readable_by": ["bob.chen@synthcorp.example", "finance@synthcorp.example"],
        "writable_by": ["bob.chen@synthcorp.example"],
        "created_at": "2026-10-31T08:00:00Z",
        "modified_at": "2026-10-31T08:00:00Z",
    },
}

# Runtime-written files (virtual, in-memory only)
_RUNTIME_FILES: Dict[str, Dict] = {}


def read_file(path: str) -> Optional[Dict]:
    """Return a copy of the file record or None if not found."""
    record = _VIRTUAL_FS.get(path) or _RUNTIME_FILES.get(path)
    return copy.deepcopy(record) if record else None


def write_file(path: str, content: str, owner: str = "bob.chen@synthcorp.example") -> Dict:
    """Write a file to the virtual runtime filesystem.  Raises if path escapes sandbox."""
    # Enforce virtual sandbox — only /docs/, /reports/, /tmp/ writable by simulation
    allowed_write_prefixes = ("/docs/", "/reports/", "/tmp/")
    if not any(path.startswith(p) for p in allowed_write_prefixes):
        raise PermissionError(f"Write denied: path {path!r} is outside the writable sandbox.")
    record = {
        "path": path,
        "content": content,
        "size_bytes": len(content.encode("utf-8")),
        "owner": owner,
        "readable_by": [owner],
        "writable_by": [owner],
        "created_at": "2026-10-31T22:00:00Z",
        "modified_at": "2026-10-31T22:00:00Z",
    }
    _RUNTIME_FILES[path] = record
    return copy.deepcopy(record)


def list_files(directory: str = "/") -> List[Dict]:
    """Return metadata (without content) for all files in the virtual filesystem under a directory."""
    all_files = {**_VIRTUAL_FS, **_RUNTIME_FILES}
    result = []
    for path, record in all_files.items():
        if path.startswith(directory):
            entry = {k: v for k, v in record.items() if k != "content"}
            result.append(entry)
    return result


def reset_filesystem() -> None:
    """Clear runtime files (for tests)."""
    global _RUNTIME_FILES
    _RUNTIME_FILES = {}

