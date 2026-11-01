"""Unit tests for Phase 3 — Gemini Client (backend/app/ai/gemini_client.py).

Uses mocked responses to guarantee deterministic, cost-free testing.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.ai.gemini_client import GeminiClient
from app.config import Settings
from app.core.errors import ConfigurationError
from app.schemas.agent import (
    AttackCategory,
    GuardianAssessment,
    RedAttackPayload,
    TargetProposal,
)
from app.schemas.common import PolicyDecisionEnum, ThreatSeverity


@pytest.fixture
def test_settings():
    return Settings(
        gemini_api_key="fake-gemini-test-key-123456",
        gemini_model="gemini-3.8-flash",
    )


class TestGeminiClientInit:
    def test_missing_key_raises_configuration_error(self):
        settings = Settings(gemini_api_key=None)
        client = GeminiClient(settings)
        with pytest.raises(ConfigurationError, match="GEMINI_API_KEY is not configured"):
            _ = client.client

    @patch("app.ai.gemini_client.genai.Client")
    def test_client_initialization_with_key(self, mock_genai_cls, test_settings):
        client = GeminiClient(test_settings)
        _ = client.client
        mock_genai_cls.assert_called_once_with(api_key="fake-gemini-test-key-123456")


class TestStructuredGeneration:
    @pytest.mark.asyncio
    @patch.object(GeminiClient, "_sleep_backoff", new_callable=AsyncMock)
    async def test_successful_red_attack_generation(self, mock_sleep, test_settings):
        client = GeminiClient(test_settings)

        # Mock API response
        mock_response = MagicMock()
        mock_response.text = (
            '{"attack_id": "atk-1", "category": "prompt_injection", '
            '"intended_goal": "Exfiltrate email", "strategy_summary": "System override", '
            '"payload_text": "Ignore previous instructions", "target_surface": "user_prompt"}'
        )
        mock_usage = MagicMock()
        mock_usage.prompt_token_count = 120
        mock_usage.candidates_token_count = 45
        mock_usage.total_token_count = 165
        mock_response.usage_metadata = mock_usage

        mock_aio_models = MagicMock()
        mock_aio_models.generate_content = AsyncMock(return_value=mock_response)
        client._client = MagicMock()
        client._client.aio.models = mock_aio_models

        result = await client.generate_structured(
            prompt="Generate prompt injection",
            response_schema=RedAttackPayload,
        )

        assert result.is_fallback is False
        assert result.error is None
        assert result.data is not None
        assert result.data.attack_id == "atk-1"
        assert result.data.category == AttackCategory.PROMPT_INJECTION
        assert result.usage.total_tokens == 165
        assert result.latency_ms >= 0
        mock_sleep.assert_not_called()

    @pytest.mark.asyncio
    @patch.object(GeminiClient, "_sleep_backoff", new_callable=AsyncMock)
    async def test_successful_guardian_assessment(self, mock_sleep, test_settings):
        client = GeminiClient(test_settings)

        mock_response = MagicMock()
        mock_response.text = (
            '{"threat_detected": true, "risk_score": 0.85, "severity": "HIGH", '
            '"indicators": ["PROMPT_INJECTION"], "explanation": "Attacking system prompt", '
            '"recommended_action": "BLOCK"}'
        )
        mock_response.usage_metadata = None

        mock_aio_models = MagicMock()
        mock_aio_models.generate_content = AsyncMock(return_value=mock_response)
        client._client = MagicMock()
        client._client.aio.models = mock_aio_models

        result = await client.generate_structured(
            prompt="Evaluate threat",
            response_schema=GuardianAssessment,
        )

        assert result.is_fallback is False
        assert result.data is not None
        assert result.data.threat_detected is True
        assert result.data.risk_score == 0.85
        assert result.data.severity == ThreatSeverity.HIGH
        assert result.data.recommended_action == PolicyDecisionEnum.BLOCK


class TestRetryAndFailClosed:
    @pytest.mark.asyncio
    @patch.object(GeminiClient, "_sleep_backoff", new_callable=AsyncMock)
    async def test_http_429_retries_and_succeeds(self, mock_sleep, test_settings):
        client = GeminiClient(test_settings)

        # First call raises 429 ResourceExhausted; second call succeeds
        mock_success = MagicMock()
        mock_success.text = (
            '{"thought_process": "Thinking", "user_response": "Hello", '
            '"tool_name": "none", "operation": "none", "parameters": {}, "rationale": "Direct answer"}'
        )
        mock_success.usage_metadata = None

        mock_aio_models = MagicMock()
        mock_aio_models.generate_content = AsyncMock(
            side_effect=[RuntimeError("429 ResourceExhausted rate limit exceeded"), mock_success]
        )
        client._client = MagicMock()
        client._client.aio.models = mock_aio_models

        result = await client.generate_structured(
            prompt="Perform task",
            response_schema=TargetProposal,
        )

        assert result.is_fallback is False
        assert result.data is not None
        assert result.data.user_response == "Hello"
        assert mock_sleep.call_count == 1

    @pytest.mark.asyncio
    @patch.object(GeminiClient, "_sleep_backoff", new_callable=AsyncMock)
    async def test_transient_5xx_retries_and_succeeds(self, mock_sleep, test_settings):
        client = GeminiClient(test_settings)

        mock_success = MagicMock()
        mock_success.text = (
            '{"thought_process": "T", "user_response": "Done", '
            '"tool_name": "none", "operation": "none", "parameters": {}, "rationale": "R"}'
        )
        mock_success.usage_metadata = None

        mock_aio_models = MagicMock()
        mock_aio_models.generate_content = AsyncMock(
            side_effect=[RuntimeError("503 Service Unavailable"), mock_success]
        )
        client._client = MagicMock()
        client._client.aio.models = mock_aio_models

        result = await client.generate_structured(
            prompt="Perform task",
            response_schema=TargetProposal,
        )

        assert result.is_fallback is False
        assert mock_sleep.call_count == 1

    @pytest.mark.asyncio
    @patch.object(GeminiClient, "_sleep_backoff", new_callable=AsyncMock)
    async def test_timeout_retries_and_succeeds(self, mock_sleep, test_settings):
        client = GeminiClient(test_settings)

        mock_success = MagicMock()
        mock_success.text = (
            '{"thought_process": "T", "user_response": "Done", '
            '"tool_name": "none", "operation": "none", "parameters": {}, "rationale": "R"}'
        )
        mock_success.usage_metadata = None

        mock_aio_models = MagicMock()
        mock_aio_models.generate_content = AsyncMock(
            side_effect=[asyncio.TimeoutError("Request timed out"), mock_success]
        )
        client._client = MagicMock()
        client._client.aio.models = mock_aio_models

        result = await client.generate_structured(
            prompt="Perform task",
            response_schema=TargetProposal,
        )

        assert result.is_fallback is False
        assert mock_sleep.call_count == 1

    @pytest.mark.asyncio
    @patch.object(GeminiClient, "_sleep_backoff", new_callable=AsyncMock)
    async def test_max_retries_exhausted_triggers_guardian_fail_closed(self, mock_sleep, test_settings):
        client = GeminiClient(test_settings)

        # All 3 attempts raise transient errors
        mock_aio_models = MagicMock()
        mock_aio_models.generate_content = AsyncMock(
            side_effect=RuntimeError("500 Internal Server Error")
        )
        client._client = MagicMock()
        client._client.aio.models = mock_aio_models

        result = await client.generate_structured(
            prompt="Analyze payload",
            response_schema=GuardianAssessment,
            max_retries=3,
        )

        # Must fail-closed!
        assert result.is_fallback is True
        assert result.error is not None
        assert result.data is not None
        assert result.data.threat_detected is True
        assert result.data.risk_score == 1.0
        assert result.data.severity == ThreatSeverity.CRITICAL
        assert result.data.recommended_action == PolicyDecisionEnum.BLOCK
        assert "FAIL_CLOSED_TRIGGERED" in result.data.indicators
        assert mock_sleep.call_count == 2  # slept between attempt 1->2 and 2->3

    @pytest.mark.asyncio
    @patch.object(GeminiClient, "_sleep_backoff", new_callable=AsyncMock)
    async def test_malformed_json_retries_and_fails_closed(self, mock_sleep, test_settings):
        client = GeminiClient(test_settings)

        mock_bad_resp = MagicMock()
        mock_bad_resp.text = "This is not valid json at all!"
        mock_bad_resp.usage_metadata = None

        mock_aio_models = MagicMock()
        mock_aio_models.generate_content = AsyncMock(return_value=mock_bad_resp)
        client._client = MagicMock()
        client._client.aio.models = mock_aio_models

        result = await client.generate_structured(
            prompt="Analyze payload",
            response_schema=GuardianAssessment,
            max_retries=2,
        )

        assert result.is_fallback is True
        assert result.data is not None
        assert result.data.recommended_action == PolicyDecisionEnum.BLOCK

    @pytest.mark.asyncio
    @patch.object(GeminiClient, "_sleep_backoff", new_callable=AsyncMock)
    async def test_non_transient_error_fails_immediately_without_retrying(self, mock_sleep, test_settings):
        client = GeminiClient(test_settings)

        mock_aio_models = MagicMock()
        mock_aio_models.generate_content = AsyncMock(
            side_effect=ValueError("Invalid model argument: unrecognized parameter")
        )
        client._client = MagicMock()
        client._client.aio.models = mock_aio_models

        result = await client.generate_structured(
            prompt="Test",
            response_schema=RedAttackPayload,
            max_retries=3,
        )

        assert result.is_fallback is True
        # Should NOT sleep/retry for permanent non-transient errors
        mock_sleep.assert_not_called()

