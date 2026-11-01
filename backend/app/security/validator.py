"""Cryptographic SHA-256 Action Hash Validator.

Implements SEC-006:
Deterministic canonical JSON serialization and action hash generation/verification:
action_hash = SHA256(simulation_id + tool + operation + canonical_json(params))
"""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any, Dict, Optional


def canonical_json(data: Any) -> str:
    """Serialize data into deterministic canonical JSON format.

    - Keys sorted recursively
    - Compact separators (',', ':')
    - UTF-8 representation
    """
    if data is None:
        return "{}"
    if isinstance(data, dict):
        # Recursively ensure inner dictionaries/lists are canonically formatted
        cleaned = {}
        for k in sorted(data.keys()):
            val = data[k]
            if isinstance(val, (dict, list)):
                cleaned[str(k)] = json.loads(canonical_json(val))
            else:
                cleaned[str(k)] = val
        return json.dumps(cleaned, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    elif isinstance(data, list):
        cleaned_list = []
        for item in data:
            if isinstance(item, (dict, list)):
                cleaned_list.append(json.loads(canonical_json(item)))
            else:
                cleaned_list.append(item)
        return json.dumps(cleaned_list, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    else:
        return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def compute_action_hash(
    simulation_id: str,
    tool: str,
    operation: str,
    parameters: Optional[Dict[str, Any]] = None,
) -> str:
    """Compute deterministic cryptographic SHA-256 hash over proposed action.

    Formula:
        action_hash = SHA256(simulation_id + tool + operation + canonical_json(params))

    Raises:
        ValueError: If simulation_id, tool, or operation is missing/empty.
    """
    if not simulation_id or not isinstance(simulation_id, str) or not simulation_id.strip():
        raise ValueError("simulation_id must be a non-empty string")
    if not tool or not isinstance(tool, str) or not tool.strip():
        raise ValueError("tool must be a non-empty string")
    if not operation or not isinstance(operation, str) or not operation.strip():
        raise ValueError("operation must be a non-empty string")

    params_canonical = canonical_json(parameters or {})
    raw_payload = f"{simulation_id.strip()}:{tool.strip()}:{operation.strip()}:{params_canonical}"
    return hashlib.sha256(raw_payload.encode("utf-8")).hexdigest()


def verify_action_hash(
    expected_hash: str,
    simulation_id: str,
    tool: str,
    operation: str,
    parameters: Optional[Dict[str, Any]] = None,
) -> bool:
    """Verify an action against an expected SHA-256 hash using constant-time comparison.

    Returns False if values are malformed or hashes do not match.
    """
    if not expected_hash or not isinstance(expected_hash, str):
        return False

    try:
        calculated_hash = compute_action_hash(
            simulation_id=simulation_id,
            tool=tool,
            operation=operation,
            parameters=parameters,
        )
    except ValueError:
        return False

    return hmac.compare_digest(expected_hash.strip().lower(), calculated_hash.lower())

