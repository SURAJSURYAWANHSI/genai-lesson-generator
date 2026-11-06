"""Environment-based configuration. Secrets live here and never leave the backend."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.errors import ConfigurationError

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent

ProviderName = Literal["mock", "anthropic", "openai", "gemini"]
Role = Literal["generator", "evaluator"]

MOCK_MODEL_NAME = "mock-rule-based-v1"
# Defaults only for vendors whose current model IDs were checked against official docs.
# OpenAI must be configured explicitly with GENERATOR_MODEL.
DEFAULT_MODELS: dict[str, str] = {
    "gemini": "gemini-3.8-flash",
    "anthropic": "claude-opus-5-5",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(REPO_ROOT / ".env", BACKEND_DIR / ".env"),
        extra="ignore",
        populate_by_name=True,
    )

    app_env: Literal["development", "test", "production"] = "development"
    database_url: str = "sqlite:///./data/lessons.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    log_level: str = "INFO"

    # Real by default. Mock runs only when explicitly chosen, and never as a silent fallback.
    llm_provider: ProviderName = "gemini"
    evaluator_provider: ProviderName | None = None
    generator_model: str | None = None
    evaluator_model: str | None = None
    anthropic_api_key: SecretStr | None = None
    openai_api_key: SecretStr | None = None
    google_api_key: SecretStr | None = Field(
        default=None, validation_alias=AliasChoices("GOOGLE_API_KEY", "GEMINI_API_KEY")
    )

    llm_timeout_seconds: float = Field(default=300, gt=0)
    llm_provider_retries: int = Field(default=2, ge=0, le=5)
    llm_max_output_tokens: int = Field(default=16000, gt=0)
    anthropic_effort: Literal["low", "medium", "high", "xhigh", "max"] = "high"
    anthropic_refusal_fallback: bool = True

    generator_input_cost_per_mtok: float | None = Field(default=None, ge=0)
    generator_output_cost_per_mtok: float | None = Field(default=None, ge=0)
    evaluator_input_cost_per_mtok: float | None = Field(default=None, ge=0)
    evaluator_output_cost_per_mtok: float | None = Field(default=None, ge=0)

    min_lesson_words: int = Field(default=500, ge=1)
    max_lesson_words: int = Field(default=6000, ge=1)
    max_reference_chars: int = Field(default=20000, ge=1)
    max_topic_chars: int = Field(default=300, ge=3)
    rate_limit_per_minute: int = Field(default=20, ge=1)

    memory_pattern_min_occurrences: int = Field(default=2, ge=1)
    evolution_min_failures: int = Field(default=3, ge=1)
    evolution_min_strategy_successes: int = Field(default=2, ge=1)
    evolution_include_demo_runs: bool = True

    @field_validator(
        "evaluator_provider", "generator_model", "evaluator_model",
        "anthropic_api_key", "openai_api_key", "google_api_key",
        mode="before",
    )
    @classmethod
    def _blank_means_unset(cls, value: object) -> object:
        """A blank line in .env must count as missing, not as an empty key or model."""
        return None if isinstance(value, str) and not value.strip() else value

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def demo_allowed(self) -> bool:
        return not self.is_production

    def provider_for(self, role: Role) -> ProviderName:
        if role == "evaluator" and self.evaluator_provider:
            return self.evaluator_provider
        return self.llm_provider

    def model_for(self, role: Role) -> str:
        provider = self.provider_for(role)
        if provider == "mock":
            return MOCK_MODEL_NAME
        configured = self.generator_model if role == "generator" else self.evaluator_model
        # A separately configured evaluator model only applies to that role. The generator
        # model is reused for the evaluator only when both roles share one vendor.
        if not configured and role == "evaluator" and provider == self.llm_provider:
            configured = self.generator_model
        if configured:
            return configured
        if provider in DEFAULT_MODELS:
            return DEFAULT_MODELS[provider]
        raise ConfigurationError(
            f"{role.upper()}_MODEL must be set when the {role} provider is '{provider}'."
        )

    def api_key_for(self, provider: ProviderName) -> SecretStr | None:
        return {
            "anthropic": self.anthropic_api_key,
            "openai": self.openai_api_key,
            "gemini": self.google_api_key,
        }.get(provider)

    def costs_for(self, role: Role) -> tuple[float | None, float | None]:
        if role == "generator":
            return self.generator_input_cost_per_mtok, self.generator_output_cost_per_mtok
        return self.evaluator_input_cost_per_mtok, self.evaluator_output_cost_per_mtok

    def validate_runtime(self) -> None:
        """Fail early, with a clear message, on a configuration that cannot work."""
        if self.min_lesson_words >= self.max_lesson_words:
            raise ConfigurationError("MIN_LESSON_WORDS must be lower than MAX_LESSON_WORDS.")
        for role in ("generator", "evaluator"):
            provider = self.provider_for(role)
            if provider == "mock":
                if self.is_production:
                    raise ConfigurationError(
                        "The mock provider is not allowed when APP_ENV=production."
                    )
                continue
            if self.api_key_for(provider) is None:
                raise ConfigurationError(
                    f"An API key is required for the '{provider}' provider."
                )
            self.model_for(role)


@lru_cache
def get_settings() -> Settings:
    return Settings()
