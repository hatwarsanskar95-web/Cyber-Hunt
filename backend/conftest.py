"""Pytest configuration and shared fixtures for CYBER HUNT backend tests.

Ensures the backend ``app`` package is importable regardless of how pytest
is invoked (from project root or from backend/ directory).
"""

import sys
import os

# Make sure 'backend' is on sys.path so `from app.xxx import ...` works.
_backend_dir = os.path.dirname(__file__)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

