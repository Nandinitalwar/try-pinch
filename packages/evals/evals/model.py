"""Thin Gemini wrapper for the live eval.

Kept deliberately minimal — one function, no retries, no streaming. The
harness above this is a test runner, not a production client; if Gemini
flakes, the run gets marked as such in the report and we move on.
"""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class ModelReply:
    text: str
    model: str
    latency_ms: int


def call_gemini(
    system_prompt: str,
    user_message: str,
    model: str = "gemini-2.5-flash",
    api_key: str | None = None,
) -> ModelReply:
    """Single-turn call. Returns the reply text + basic telemetry.

    `user_message` may be a single line or multi-turn transcript (the cases
    module uses the [assistant]/[user] markers to simulate multi-turn).
    Raises if GOOGLE_AI_API_KEY isn't set and no api_key is passed.
    """
    import time

    # Lazy import so the package imports cleanly without google-generativeai.
    import google.generativeai as genai

    key = api_key or os.environ.get("GOOGLE_AI_API_KEY")
    if not key:
        raise RuntimeError(
            "GOOGLE_AI_API_KEY not set. Live evals require a Gemini API key."
        )
    genai.configure(api_key=key)

    gm = genai.GenerativeModel(model_name=model, system_instruction=system_prompt)
    t0 = time.monotonic()
    resp = gm.generate_content(user_message)
    latency = int((time.monotonic() - t0) * 1000)

    return ModelReply(text=resp.text or "", model=model, latency_ms=latency)
