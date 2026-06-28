# app/prompts.py
# Re-exports from app.utils.prompts so that graph.py and cost_estimator.py
# can import from `app.prompts` as expected.
from app.utils.prompts import SYSTEM_FIRST_PROMPT, SYSTEM_GRAPH_PROMPT

__all__ = ["SYSTEM_FIRST_PROMPT", "SYSTEM_GRAPH_PROMPT"]
