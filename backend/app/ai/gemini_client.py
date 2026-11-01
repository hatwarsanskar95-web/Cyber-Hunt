"""Google Gemini Client Wrapper for CYBER HUNT.

Implements:
- AI-001: genai.Client initialization with centralized settings.
- AI-002: Structured output enforcement using Pydantic schemas.
- AI-003: Exponential backoff with jitter (up to 3 attempts) for transient errors.
- AI-004: Latency (ms) and token usage tracking.
- AI-005: Fail-closed fallback handling (denies/blocks on security evaluation failure).
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
import time
from typing import Any, Optional, Type, TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.config import Settings, get_settings
from app.core.errors import AgentExecutionError, ConfigurationError
from app.schemas.agent import GeminiExecutionResult, GuardianAssessment, TokenUsage

log = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# Default retry settings
MAX_RETRIES = 3
INITIAL_BACKOFF_SECONDS = 1.0
BACKOFF_FACTOR = 2.0
MAX_BACKOFF_SECONDS = 8.0


class GeminiClient:
    """Robust, type-safe client wrapper for Google Gemini models."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self.model_id = self.settings.gemini_model
        self._client: Optional[genai.Client] = None

    @property
    def client(self) -> genai.Client:
        """Lazily initialize and return the underlying genai.Client."""
        if self._client is not None:
            return self._client

        api_key_str = ""
        if self.settings.gemini_api_key:
            api_key_str = self.settings.gemini_api_key.get_secret_value()

        if not api_key_str:
            raise ConfigurationError(
                "GEMINI_API_KEY is not configured. Provide it in .env or environment variables."
            )

        self._client = genai.Client(api_key=api_key_str)
        log.info(
            "Gemini client initialized successfully",
            extra={"model": self.model_id, "has_key": bool(api_key_str)},
        )
        return self._client

    async def generate_structured(
        self,
        prompt: str,
        response_schema: Type[T],
        system_instruction: Optional[str] = None,
        model_override: Optional[str] = None,
        max_retries: int = MAX_RETRIES,
        timeout_seconds: float = 30.0,
    ) -> GeminiExecutionResult[T]:
        """Generate structured completion adhering strictly to a Pydantic schema.

        Retries transient errors (429, 5xx, timeouts) with exponential backoff and jitter.
        Fails closed if the security guardian assessment cannot be produced.
        """
        model = model_override or self.model_id
        start_time = time.perf_counter()
        raw_text = ""
        usage = TokenUsage()

        # Build GenerateContentConfig
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            system_instruction=system_instruction,
        )

        last_error: Optional[Exception] = None

        for attempt in range(1, max_retries + 1):
            try:
                # Execute async generation with timeout
                response = await asyncio.wait_for(
                    self.client.aio.models.generate_content(
                        model=model,
                        contents=prompt,
                        config=config,
                    ),
                    timeout=timeout_seconds,
                )

                latency_ms = int((time.perf_counter() - start_time) * 1000)
                raw_text = getattr(response, "text", "") or ""

                # Extract token usage safely
                usage_meta = getattr(response, "usage_metadata", None)
                if usage_meta:
                    usage = TokenUsage(
                        input_tokens=getattr(usage_meta, "prompt_token_count", 0) or 0,
                        output_tokens=getattr(usage_meta, "candidates_token_count", 0) or 0,
                        total_tokens=getattr(usage_meta, "total_token_count", 0) or 0,
                    )

                # Validate structured response
                validated_data = response_schema.model_validate_json(raw_text)

                return GeminiExecutionResult[T](
                    data=validated_data,
                    raw_text=raw_text,
                    model_id=model,
                    latency_ms=latency_ms,
                    usage=usage,
                    is_fallback=False,
                    error=None,
                )

            except ValidationError as val_err:
                # Schema mismatch or corrupt JSON returned by model
                log.warning(
                    "Model output failed Pydantic validation (attempt %d/%d): %s",
                    attempt,
                    max_retries,
                    val_err,
                )
                last_error = val_err
                # Retry if attempts remain
                if attempt < max_retries:
                    await self._sleep_backoff(attempt)
                    continue

            except (TimeoutError, asyncio.TimeoutError) as timeout_err:
                log.warning(
                    "Gemini API request timed out after %.1fs (attempt %d/%d)",
                    timeout_seconds,
                    attempt,
                    max_retries,
                )
                last_error = timeout_err
                if attempt < max_retries:
                    await self._sleep_backoff(attempt)
                    continue

            except Exception as exc:
                error_str = str(exc)
                is_quota_exhausted = any(
                    q in error_str.lower() for q in ("quota", "resource_exhausted", "resourceexhausted", "limit: 20")
                )
                is_transient = (
                    not is_quota_exhausted
                    and any(
                        code in error_str
                        for code in ("429", "500", "503", "504", "Unavailable")
                    )
                )
                log.warning(
                    "Gemini API invocation error (attempt %d/%d, transient=%s): %s",
                    attempt,
                    max_retries,
                    is_transient,
                    error_str,
                )
                last_error = exc
                if is_transient and attempt < max_retries:
                    await self._sleep_backoff(attempt)
                    continue
                else:
                    # Non-transient or exhausted quota fails immediately to safe deterministic fallback
                    break

        # Retries exhausted or non-transient error -> AI-005 Fail-Closed Handling
        latency_ms = int((time.perf_counter() - start_time) * 1000)
        err_msg = str(last_error) if last_error else "Unknown generation error"
        log.error("Gemini invocation failed completely after retries: %s", err_msg)

        fallback_data = self._resolve_fallback(response_schema, err_msg)

        return GeminiExecutionResult[T](
            data=fallback_data,
            raw_text=raw_text,
            model_id=model,
            latency_ms=latency_ms,
            usage=usage,
            is_fallback=True,
            error=err_msg,
        )

    def _resolve_fallback(self, schema: Type[T], reason: str) -> Optional[T]:
        """Produce a fail-closed fallback data instance when safety requires it."""
        if schema == GuardianAssessment or issubclass(schema, GuardianAssessment):
            # Blue Team Guardian must fail-closed: block by default with 1.0 risk!
            log.warning("Activating FAIL-CLOSED Guardian security fallback.")
            return schema.fail_closed_fallback(reason=reason)  # type: ignore[return-value]
        return None

    async def _sleep_backoff(self, attempt: int) -> None:
        """Sleep with exponential backoff and jitter."""
        base_delay = INITIAL_BACKOFF_SECONDS * (BACKOFF_FACTOR ** (attempt - 1))
        jitter = random.uniform(0.1, 0.5)
        sleep_duration = min(base_delay + jitter, MAX_BACKOFF_SECONDS)
        log.info("Backing off for %.2fs before retry %d", sleep_duration, attempt + 1)
        await asyncio.sleep(sleep_duration)


_client_instance: Optional[GeminiClient] = None


def get_gemini_client(settings: Optional[Settings] = None) -> GeminiClient:
    """Return a singleton instance of GeminiClient."""
    global _client_instance
    if _client_instance is None:
        _client_instance = GeminiClient(settings)
    return _client_instance

