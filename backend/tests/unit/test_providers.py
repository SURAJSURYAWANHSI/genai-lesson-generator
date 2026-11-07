"""Provider adapters, tested offline. These prove request shapes and error handling, not live calls."""

import pytest
from langchain_core.messages import HumanMessage

from app.core.config import Settings
from app.core.errors import (
    ConfigurationError,
    InvalidModelOutputError,
    ProviderError,
    ProviderTimeoutError,
)
from app.llm.factory import build_provider
from app.llm.langchain_provider import LangChainProvider, build_chat_model
from app.llm.mock import MockProvider
from app.schemas.lesson import Lesson


def settings(**overrides) -> Settings:
    values = {"llm_provider": "mock", "evaluator_provider": None, "generator_model": None, "evaluator_model": None}
    values.update(overrides)
    return Settings(_env_file=None, **values)


class FakeChatModel:
    """Stands in for a LangChain chat model at the with_structured_output boundary."""

    def __init__(self, result=None, error=None):
        self.result, self.error, self.calls = result, error, []

    def with_structured_output(self, schema, **kwargs):
        self.calls.append(kwargs)
        return self

    def invoke(self, _messages):
        if self.error:
            raise self.error
        return self.result


def provider_with(**kwargs) -> tuple[LangChainProvider, FakeChatModel]:
    model = FakeChatModel(**kwargs)
    return LangChainProvider("openai", "some-model", model, 2.0, 4.0), model


class _Raw:
    usage_metadata = {"input_tokens": 1000, "output_tokens": 500}
    response_metadata = {"stop_reason": "max_tokens"}


def test_structured_output_uses_native_json_schema(lesson):
    provider, model = provider_with(result={"raw": _Raw(), "parsed": lesson})
    result = provider.generate_structured(Lesson, "system", "user")
    assert model.calls == [{"method": "json_schema", "include_raw": True}]
    assert result.parsed == lesson
    assert (result.input_tokens, result.output_tokens) == (1000, 500)
    assert result.cost_usd == pytest.approx(0.004)


def test_cost_is_null_when_rates_are_not_configured(lesson):
    model = FakeChatModel(result={"raw": _Raw(), "parsed": lesson})
    result = LangChainProvider("openai", "m", model).generate_structured(Lesson, "s", "u")
    assert result.cost_usd is None


def test_unparsed_output_reports_the_stop_reason():
    provider, _ = provider_with(result={"raw": _Raw(), "parsed": None})
    with pytest.raises(InvalidModelOutputError, match="max_tokens"):
        provider.generate_structured(Lesson, "s", "u")


def test_provider_failures_are_handled():
    class RateLimitError(Exception):
        pass

    provider, _ = provider_with(error=RateLimitError("secret-key-abc in the provider message"))
    with pytest.raises(ProviderError) as caught:
        provider.generate_structured(Lesson, "s", "u")
    assert "RateLimitError" in str(caught.value)
    assert "secret-key-abc" not in str(caught.value), "Provider messages must not reach clients."


def test_provider_timeout_is_handled():
    class APITimeoutError(Exception):
        pass

    provider, _ = provider_with(error=APITimeoutError())
    with pytest.raises(ProviderTimeoutError):
        provider.generate_structured(Lesson, "s", "u")


@pytest.mark.parametrize(
    "code, expected, phrase",
    [
        (503, ProviderError, "overloaded"),
        (429, ProviderError, "quota"),
        (404, ProviderError, "GENERATOR_MODEL"),
        (400, ProviderError, "API key"),
        (504, ProviderTimeoutError, "timed out"),
    ],
)
def test_provider_status_gives_useful_advice_without_echoing_its_message(code, expected, phrase):
    class GoogleAPIError(Exception):
        pass

    error = GoogleAPIError("response included secret-key-abc")
    error.code = code
    provider, _ = provider_with(error=error)
    with pytest.raises(expected) as caught:
        provider.generate_structured(Lesson, "s", "u")
    assert phrase in str(caught.value)
    assert "secret-key-abc" not in str(caught.value)


def test_status_is_read_from_error_text_when_the_adapter_has_no_code_attribute():
    class GoogleRateLimitError(Exception):
        pass

    error = GoogleRateLimitError("Error calling model (RESOURCE_EXHAUSTED): 429 RESOURCE_EXHAUSTED. Quota secret-detail")
    provider, _ = provider_with(error=error)
    with pytest.raises(ProviderError) as caught:
        provider.generate_structured(Lesson, "s", "u")
    assert "quota" in str(caught.value)
    assert "secret-detail" not in str(caught.value)


def anthropic_payload(config: Settings) -> dict:
    model = build_chat_model("anthropic", config.model_for("generator"), config)
    bound = model.with_structured_output(Lesson, method="json_schema", include_raw=True)
    binding = bound.steps__["raw"] if hasattr(bound, "steps__") else None
    kwargs = next(
        step.kwargs
        for step in _walk_bindings(binding or bound)
        if "output_config" in getattr(step, "kwargs", {})
    )
    return model._get_request_payload([HumanMessage(content="hi")], **kwargs)


def _walk_bindings(runnable):
    yield runnable
    for attribute in ("first", "middle", "last", "bound"):
        child = getattr(runnable, attribute, None)
        if isinstance(child, list):
            for item in child:
                yield from _walk_bindings(item)
        elif child is not None and hasattr(child, "invoke"):
            yield from _walk_bindings(child)
    for child in getattr(runnable, "steps__", {}).values():
        yield from _walk_bindings(child)
    for branch in getattr(runnable, "runnables", []) or []:
        yield from _walk_bindings(branch)


def test_claude_request_is_valid_for_current_models():
    """Current Claude models return 400 for temperature and for forced tool_choice."""
    config = settings(llm_provider="anthropic", anthropic_api_key="test-key")
    payload = anthropic_payload(config)
    assert payload["model"] == "claude-opus-5-5"
    assert payload["max_tokens"] == 16000
    assert "temperature" not in payload
    assert "tool_choice" not in payload and "tools" not in payload
    assert payload["output_config"]["effort"] == "high"
    assert payload["output_config"]["format"]["type"] == "json_schema"
    assert payload["fallbacks"] == "default"
    assert payload["betas"] == ["server-side-fallback-2026-07-01"]


def test_claude_refusal_fallback_can_be_disabled():
    config = settings(llm_provider="anthropic", anthropic_api_key="k", anthropic_refusal_fallback=False)
    payload = anthropic_payload(config)
    assert "fallbacks" not in payload and "betas" not in payload


@pytest.mark.parametrize("provider, key_field", [("openai", "openai_api_key"), ("gemini", "google_api_key")])
def test_openai_and_gemini_adapters_build_offline(provider, key_field):
    config = settings(llm_provider=provider, generator_model="configured-model", **{key_field: "test-key"})
    built = build_provider("generator", config)
    assert isinstance(built, LangChainProvider)
    assert (built.provider_name, built.model_name) == (provider, "configured-model")


def test_openai_has_no_guessed_default_model():
    config = settings(llm_provider="openai", openai_api_key="test-key")
    with pytest.raises(ConfigurationError, match="GENERATOR_MODEL"):
        config.model_for("generator")


def test_gemini_is_the_default_provider_with_no_silent_fallback_to_mock(monkeypatch):
    for name in ("LLM_PROVIDER", "EVALUATOR_PROVIDER", "GOOGLE_API_KEY", "GEMINI_API_KEY"):
        monkeypatch.delenv(name, raising=False)
    config = Settings(_env_file=None)
    assert config.llm_provider == "gemini"
    assert config.model_for("generator") == config.model_for("evaluator") == "gemini-3.6-flash"
    with pytest.raises(ConfigurationError, match="API key is required for the 'gemini'"):
        config.validate_runtime()
    with pytest.raises(ConfigurationError):
        build_provider("generator", config)


def test_swapping_gemini_model_or_vendor_only_needs_configuration(monkeypatch):
    monkeypatch.setenv("GENERATOR_MODEL", "some-newer-gemini-model")
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("EVALUATOR_PROVIDER", "")
    monkeypatch.setenv("GOOGLE_API_KEY", "first-key")
    config = Settings(_env_file=None)
    assert build_provider("generator", config).model_name == "some-newer-gemini-model"
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "other-key")
    monkeypatch.delenv("GENERATOR_MODEL")
    assert build_provider("generator", Settings(_env_file=None)).provider_name == "anthropic"


def test_gemini_key_is_accepted_under_either_name(monkeypatch):
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "from-gemini-name")
    assert Settings(_env_file=None).google_api_key.get_secret_value() == "from-gemini-name"
    monkeypatch.delenv("GEMINI_API_KEY")
    monkeypatch.setenv("GOOGLE_API_KEY", "from-google-name")
    assert Settings(_env_file=None).google_api_key.get_secret_value() == "from-google-name"


def test_blank_gemini_key_counts_as_missing(monkeypatch):
    monkeypatch.setenv("GOOGLE_API_KEY", "   ")
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("EVALUATOR_PROVIDER", "")
    monkeypatch.setenv("GENERATOR_MODEL", "gemini-3.8-flash")
    config = Settings(_env_file=None)
    assert config.google_api_key is None
    with pytest.raises(ConfigurationError, match="API key"):
        config.validate_runtime()


def test_missing_api_key_is_a_clear_error():
    config = settings(llm_provider="anthropic", anthropic_api_key=None)
    with pytest.raises(ConfigurationError, match="API key"):
        config.validate_runtime()


def test_mock_provider_is_refused_in_production():
    config = settings(app_env="production", llm_provider="mock")
    with pytest.raises(ConfigurationError, match="not allowed"):
        config.validate_runtime()
    with pytest.raises(ConfigurationError, match="not allowed"):
        build_provider("generator", config)


def test_mock_provider_available_in_development():
    assert isinstance(build_provider("generator", settings()), MockProvider)


def test_evaluator_can_use_a_different_vendor():
    config = settings(
        llm_provider="anthropic",
        anthropic_api_key="k",
        evaluator_provider="openai",
        openai_api_key="k",
        evaluator_model="eval-model",
    )
    assert (config.provider_for("evaluator"), config.model_for("evaluator")) == ("openai", "eval-model")
    assert config.model_for("generator") == "claude-opus-5-5"
