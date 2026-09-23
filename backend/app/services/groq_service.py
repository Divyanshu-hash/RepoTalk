"""
Groq-backed LLM service for diagram generation.
Uses langchain_groq.ChatGroq (already installed for the chat feature).
"""
from __future__ import annotations

import asyncio
import math
import os
from typing import AsyncGenerator, TypeVar

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from pydantic import BaseModel

from app.services.pricing import GenerationTokenUsage
from app.utils.format_message import format_user_message

StructuredOutputModel = TypeVar("StructuredOutputModel", bound=BaseModel)

DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b"


class GroqService:
    """
    Groq LLM Service using LangChain.

    Extra kwargs (provider, api_key, reasoning_effort) are silently ignored
    so call-sites in graph.py don't need to change.
    """

    def __init__(self) -> None:
        self.api_key = (os.getenv("GROQ_API_KEY") or "").strip()
        if not self.api_key:
            raise ValueError(
                "GROQ_API_KEY is not set. "
                "Add GROQ_API_KEY=... to .env to use the diagram generation feature."
            )

    def _get_llm(self, model: str, max_tokens: int | None = None) -> ChatGroq:
        kwargs: dict = {
            "groq_api_key": self.api_key,
            "model_name": model,
            "temperature": 0,
        }
        if max_tokens:
            kwargs["max_tokens"] = max_tokens
        return ChatGroq(**kwargs)

    # ──────────────────────────────────────────────────────────────────────────
    # Token estimation (Groq has no dedicated counting API — use local estimate)
    # ──────────────────────────────────────────────────────────────────────────
    @staticmethod
    def estimate_tokens(text: str) -> int:
        """Conservative local estimate: ~3 chars per token."""
        return 0 if not text else math.ceil(len(text) / 3) + 32

    # ──────────────────────────────────────────────────────────────────────────
    # Streaming text completion
    # ──────────────────────────────────────────────────────────────────────────
    async def stream_completion(
        self,
        *,
        model: str,
        system_prompt: str,
        data: dict[str, str | None],
        max_output_tokens: int | None = None,
        # absorb OpenAI-specific kwargs so call-sites don't need to change:
        **_kwargs,
    ) -> tuple[AsyncGenerator[str, None], asyncio.Future[GenerationTokenUsage | None]]:
        user_prompt = format_user_message(data)
        messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
        llm = self._get_llm(model, max_tokens=max_output_tokens)

        loop = asyncio.get_running_loop()
        usage_future: asyncio.Future[GenerationTokenUsage | None] = loop.create_future()

        async def text_stream() -> AsyncGenerator[str, None]:
            try:
                async for chunk in llm.astream(messages):
                    content = chunk.content
                    if isinstance(content, str) and content:
                        yield content
            finally:
                if not usage_future.done():
                    usage_future.set_result(None)

        return text_stream(), usage_future

    # ──────────────────────────────────────────────────────────────────────────
    # Structured output (JSON schema via tool calling)
    # ──────────────────────────────────────────────────────────────────────────
    async def generate_structured_output(
        self,
        *,
        model: str,
        system_prompt: str,
        data: dict[str, str | None],
        text_format: type[StructuredOutputModel],
        max_output_tokens: int | None = None,
        **_kwargs,
    ) -> tuple[StructuredOutputModel, str, GenerationTokenUsage | None]:
        user_prompt = format_user_message(data)
        messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
        llm = self._get_llm(model, max_tokens=max_output_tokens)

        structured_llm = llm.with_structured_output(text_format)
        result: StructuredOutputModel = await structured_llm.ainvoke(messages)
        raw_text = result.model_dump_json(indent=2)
        return result, raw_text, None
