"""Application exceptions. Messages here are safe to show to API clients."""


class AppError(Exception):
    """Base class for errors the application expects and handles."""


class ConfigurationError(AppError):
    """The environment configuration cannot work."""


class ProviderError(AppError):
    """The LLM provider failed (network, auth, rate limit, server error)."""


class ProviderTimeoutError(ProviderError):
    """The LLM provider did not answer in time."""


class InvalidModelOutputError(AppError):
    """The model answered, but not with output matching the required schema."""


class EvaluatorOutputError(AppError):
    """The evaluator's output stayed invalid after the corrective retry."""


class RetryLimitExceededError(AppError):
    """A generation was attempted beyond the allowed number of attempts."""


class StatusConsistencyError(AppError):
    """A final status contradicts the evaluation results."""


class RubricViolationError(AppError):
    """A rubric change would weaken or remove a mandatory criterion."""


class DuplicateRunError(AppError):
    """A run with this ID already exists."""


class RunNotFoundError(AppError):
    """The requested run does not exist."""


class ProposalNotFoundError(AppError):
    """The requested evolution proposal does not exist."""


class ProposalStateError(AppError):
    """The proposal cannot move to the requested state from its current one."""


class InjectionNotAllowedError(AppError):
    """Error injection was requested outside demo mode or in production."""


class InjectionNotApplicableError(AppError):
    """The chosen error type cannot be applied to this topic."""
