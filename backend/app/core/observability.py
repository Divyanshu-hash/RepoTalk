"""
Simple observability utilities — Timer and structured event logging.
"""
from __future__ import annotations

import logging
import time
from typing import Any

logger = logging.getLogger(__name__)


class Timer:
    """Wall-clock timer that reports elapsed milliseconds."""

    def __init__(self) -> None:
        self._start = time.perf_counter()

    def elapsed_ms(self) -> float:
        return (time.perf_counter() - self._start) * 1_000


def log_event(event: str, **kwargs: Any) -> None:
    """Emit a structured log line as INFO."""
    parts = " ".join(f"{k}={v!r}" for k, v in kwargs.items())
    logger.info("%s %s", event, parts)
