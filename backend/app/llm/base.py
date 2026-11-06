"""Provider abstraction. Agents depend only on this interface."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


@dataclass(frozen=True)
class LLMResult(Generic[T]):
    parsed: T
    input_tokens: int
    output_tokens: int
    provider: str
    model: str
    cost_usd: float | None


class LLMProvider(ABC):
    def __init__(
        self,
        provider_name: str,
        model_name: str,
        input_cost_per_mtok: float | None = None,
        output_cost_per_mtok: float | None = None,
    ) -> None:
        self.provider_name = provider_name
        self.model_name = model_name
        self.input_cost_per_mtok = input_cost_per_mtok
        self.output_cost_per_mtok = output_cost_per_mtok

    def estimate_cost(self, input_tokens: int, output_tokens: int) -> float | None:
        """Null when rates aren't configured, so no invented figure is ever reported."""
        if self.input_cost_per_mtok is None or self.output_cost_per_mtok is None:
            return None
        return (
            input_tokens * self.input_cost_per_mtok + output_tokens * self.output_cost_per_mtok
        ) / 1_000_000

    @abstractmethod
    def generate_structured(
        self, schema: type[T], system_prompt: str, user_prompt: str
    ) -> LLMResult[T]:
        """Return output parsed into `schema`.

        Raises ProviderError for provider failures and InvalidModelOutputError when the
        model's answer does not match the schema.
        """
