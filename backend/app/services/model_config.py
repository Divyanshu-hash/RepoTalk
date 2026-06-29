from __future__ import annotations

import os
from typing import Literal

AIProvider = Literal["groq"]

DEFAULT_PROVIDER: AIProvider = "groq"
DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant"

def _read_env(name: str) -> str | None:
    value = os.getenv(name, "").strip()
    return value or None


def get_provider(override_provider: str | None = None) -> AIProvider:
    candidate = (override_provider or _read_env("AI_PROVIDER") or "").strip().lower()
    if candidate == "groq":
        return "groq"

    return DEFAULT_PROVIDER


def get_provider_label(provider: AIProvider) -> str:
    labels = {
        "groq": "Groq",

    }
    return labels.get(provider, "Groq")



def get_model(provider: AIProvider | None = None) -> str:
    resolved_provider = provider or get_provider()
    if resolved_provider == "groq":
        return _read_env("GROQ_MODEL") or DEFAULT_GROQ_MODEL


    return _read_env("GROQ_MODEL") or DEFAULT_GROQ_MODEL