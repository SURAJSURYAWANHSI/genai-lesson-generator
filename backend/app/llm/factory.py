"""Builds the generator and evaluator providers from configuration."""

from dataclasses import dataclass

from app.core.config import Role, Settings
from app.core.errors import ConfigurationError
from app.llm.base import LLMProvider
from app.llm.langchain_provider import LangChainProvider, build_chat_model
from app.llm.mock import MockProvider


@dataclass(frozen=True)
class Providers:
    generator: LLMProvider
    evaluator: LLMProvider


def build_provider(role: Role, settings: Settings) -> LLMProvider:
    provider = settings.provider_for(role)
    if provider == "mock":
        if settings.is_production:
            raise ConfigurationError("The mock provider is not allowed when APP_ENV=production.")
        return MockProvider()
    if settings.api_key_for(provider) is None:
        raise ConfigurationError(f"An API key is required for the '{provider}' provider.")
    model = settings.model_for(role)
    input_cost, output_cost = settings.costs_for(role)
    return LangChainProvider(
        provider, model, build_chat_model(provider, model, settings), input_cost, output_cost
    )


def build_providers(settings: Settings) -> Providers:
    return Providers(
        generator=build_provider("generator", settings),
        evaluator=build_provider("evaluator", settings),
    )
