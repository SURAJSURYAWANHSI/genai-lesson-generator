"""Gemini, OpenAI and Claude behind one interface, through LangChain chat models.

All vendors use native JSON-schema structured output. This matters for Claude: the adapter's
default is a forced tool call, which current Claude models reject with a 400.
"""

import logging
from typing import Any, TypeVar

from langchain_core.exceptions import OutputParserException
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, ValidationError

from app.core.config import ProviderName, Settings
from app.core.errors import InvalidModelOutputError, ProviderError, ProviderTimeoutError
from app.llm.base import LLMProvider, LLMResult

T = TypeVar("T", bound=BaseModel)
logger = logging.getLogger(__name__)

# Models accepting the server-side refusal fallback's "default" form on the Claude API.
_FALLBACK_MODELS = {"claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"}
_FALLBACK_BETA = "server-side-fallback-2026-07-01"


def build_chat_model(provider: ProviderName, model: str, settings: Settings) -> BaseChatModel:
    key = settings.api_key_for(provider)
    common: dict[str, Any] = {
        "model": model,
        "timeout": settings.llm_timeout_seconds,
        "max_retries": settings.llm_provider_retries,
    }
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        # Never send temperature/top_p/top_k: current Claude models reject them.
        options: dict[str, Any] = {}
        if settings.anthropic_refusal_fallback and model in _FALLBACK_MODELS:
            options = {"betas": [_FALLBACK_BETA], "model_kwargs": {"fallbacks": "default"}}
        return ChatAnthropic(
            api_key=key,
            max_tokens=settings.llm_max_output_tokens,
            effort=settings.anthropic_effort,
            **common,
            **options,
        )
    if provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(api_key=key, max_completion_tokens=settings.llm_max_output_tokens, **common)
    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            google_api_key=key, max_output_tokens=settings.llm_max_output_tokens, **common
        )
    raise ProviderError(f"Unsupported provider '{provider}'.")


def _is_timeout(error: Exception) -> bool:
    return isinstance(error, TimeoutError) or "timeout" in type(error).__name__.lower()


class LangChainProvider(LLMProvider):
    def __init__(
        self,
        provider_name: str,
        model_name: str,
        chat_model: BaseChatModel,
        input_cost_per_mtok: float | None = None,
        output_cost_per_mtok: float | None = None,
    ) -> None:
        super().__init__(provider_name, model_name, input_cost_per_mtok, output_cost_per_mtok)
        self._chat_model = chat_model

    def generate_structured(
        self, schema: type[T], system_prompt: str, user_prompt: str
    ) -> LLMResult[T]:
        runnable = self._chat_model.with_structured_output(
            schema, method="json_schema", include_raw=True
        )
        messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
        try:
            output = runnable.invoke(messages)
        except (ValidationError, OutputParserException) as error:
            raise InvalidModelOutputError("The model returned invalid structured output.") from error
        except Exception as error:
            # The class name is enough to diagnose. Provider messages can echo request details.
            kind = type(error).__name__
            logger.error("llm_provider_error", extra={"provider": self.provider_name, "error_type": kind})
            if _is_timeout(error):
                raise ProviderTimeoutError(f"The {self.provider_name} provider timed out.") from error
            raise ProviderError(f"The {self.provider_name} provider request failed ({kind}).") from error

        raw = output.get("raw")
        parsed = output.get("parsed")
        if parsed is None:
            metadata = getattr(raw, "response_metadata", {}) or {}
            stop = metadata.get("stop_reason") or metadata.get("finish_reason") or "unknown"
            logger.warning("llm_invalid_output", extra={"provider": self.provider_name, "stop_reason": stop})
            raise InvalidModelOutputError(f"The model returned no valid structured output (stop reason: {stop}).")

        usage = getattr(raw, "usage_metadata", None) or {}
        input_tokens = int(usage.get("input_tokens", 0))
        output_tokens = int(usage.get("output_tokens", 0))
        return LLMResult(
            parsed=parsed,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            provider=self.provider_name,
            model=self.model_name,
            cost_usd=self.estimate_cost(input_tokens, output_tokens),
        )
