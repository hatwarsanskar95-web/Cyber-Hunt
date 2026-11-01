"""Mock File Tool — TOOL-005.

Simulates read/write/list operations against the synthetic virtual filesystem.
No real OS filesystem access.  All operations are sandboxed to fixtures/files.py.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

import fixtures.files as vfs

log = logging.getLogger(__name__)

SUPPORTED_OPERATIONS = frozenset(
    {"read_file", "write_file", "list_files", "read", "list", "read_config"}
)

_READ_ALIASES = {"read", "read_config"}
_LIST_ALIASES = {"list"}


def read_file(params: Dict[str, Any]) -> Dict[str, Any]:
    """Read a file from the virtual filesystem."""
    path = str(params.get("path", "")).strip()
    if not path:
        return {"operation": "read_file", "error": "path parameter is required"}

    record = vfs.read_file(path)
    if record is None:
        log.info("read_file: path=%r → NOT FOUND", path)
        return {
            "operation": "read_file",
            "path": path,
            "error": f"File not found in virtual filesystem: {path!r}",
        }

    log.info("read_file: path=%r size=%d bytes", path, record["size_bytes"])
    return {
        "operation": "read_file",
        "path": path,
        "content": record["content"],
        "size_bytes": record["size_bytes"],
        "owner": record["owner"],
        "modified_at": record["modified_at"],
    }


def write_file(params: Dict[str, Any]) -> Dict[str, Any]:
    """Write content to a path in the virtual filesystem sandbox."""
    path = str(params.get("path", "")).strip()
    content = str(params.get("content", ""))

    if not path:
        return {"operation": "write_file", "error": "path parameter is required"}

    try:
        record = vfs.write_file(path, content)
    except PermissionError as exc:
        log.warning("write_file DENIED: %s", exc)
        return {
            "operation": "write_file",
            "path": path,
            "error": str(exc),
            "status": "PERMISSION_DENIED",
        }

    log.info("write_file: path=%r size=%d bytes [SYNTHETIC]", path, record["size_bytes"])
    return {
        "operation": "write_file",
        "path": path,
        "size_bytes": record["size_bytes"],
        "status": "WRITTEN_SYNTHETIC",
        "note": "[SIMULATION] Written to in-memory virtual filesystem only.",
    }


def list_files(params: Dict[str, Any]) -> Dict[str, Any]:
    """List files in the virtual filesystem under a given directory."""
    directory = str(params.get("directory", "/")).strip() or "/"
    entries = vfs.list_files(directory)

    log.info("list_files: directory=%r count=%d", directory, len(entries))
    return {
        "operation": "list_files",
        "directory": directory,
        "count": len(entries),
        "files": entries,
    }


def execute(operation: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """Dispatch a file tool operation."""
    if operation not in SUPPORTED_OPERATIONS:
        return {
            "operation": operation,
            "error": f"Unsupported file operation: {operation!r}. "
                     f"Supported: {sorted(SUPPORTED_OPERATIONS)}",
        }
    if operation in _READ_ALIASES or operation == "read_file":
        return read_file(params)
    if operation in _LIST_ALIASES or operation == "list_files":
        return list_files(params)
    if operation == "write_file":
        return write_file(params)
    return {"operation": operation, "error": "Handler not found"}

