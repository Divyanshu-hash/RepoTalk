from __future__ import annotations

import os
from typing import Literal

AIProvider = Literal["groq", "openai", "openrouter", "atlas"]

DEFAULT_PROVIDER: AIProvider = "groq"
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
DEFAULT_ATLAS_MODEL = "deepseek-ai/DeepSeek-V3-0324"
DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o"


def _read_env(name: str) -> str | None:
    value = os.getenv(name, "").strip()
    return value or None


def get_provider(override_provider: str | None = None) -> AIProvider:
    candidate = (override_provider or _read_env("AI_PROVIDER") or "").strip().lower()
    if candidate == "groq":
        return "groq"
    if candidate == "openai":
        return "openai"
    if candidate == "openrouter":
        return "openrouter"
    if candidate == "atlas":
        return "atlas"
    return DEFAULT_PROVIDER


def get_provider_label(provider: AIProvider) -> str:
    labels = {
        "groq": "Groq",
        "openai": "OpenAI",
        "openrouter": "OpenRouter",
        "atlas": "Atlas Cloud",
    }
    return labels.get(provider, "Groq")


def supports_exact_input_token_count(provider: AIProvider) -> bool:
    # Only OpenAI exposes a dedicated token-counting API endpoint.
    return provider == "openai"


def should_use_exact_input_token_count(
    provider: AIProvider,
    api_key: str | None,
) -> bool:
    return supports_exact_input_token_count(provider) and bool((api_key or "").strip())


def get_model(provider: AIProvider | None = None) -> str:
    resolved_provider = provider or get_provider()
    if resolved_provider == "groq":
        return _read_env("GROQ_MODEL") or DEFAULT_GROQ_MODEL
    if resolved_provider == "atlas":
        return _read_env("ATLAS_MODEL") or DEFAULT_ATLAS_MODEL
    if resolved_provider == "openrouter":
        return _read_env("OPENROUTER_MODEL") or DEFAULT_OPENROUTER_MODEL
    return _read_env("OPENAI_MODEL") or DEFAULT_OPENAI_MODEL