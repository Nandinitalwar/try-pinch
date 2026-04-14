"""Stage 0 runner: no isolation. Every escape attempt will succeed.

This file exists to be unsafe. Later stages replace it with progressively
harder-to-escape implementations while keeping this function signature.
"""
from __future__ import annotations

import subprocess
import sys
import time
from dataclasses import dataclass


@dataclass
class Result:
    stdout: str
    stderr: str
    exit_code: int
    duration_s: float
    timed_out: bool = False


def run(code: str, stdin: str = "", timeout: float | None = None) -> Result:
    started = time.monotonic()
    try:
        completed = subprocess.run(
            [sys.executable, "-c", code],
            input=stdin,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as e:
        return Result(
            stdout=(e.stdout or b"").decode(errors="replace") if isinstance(e.stdout, bytes) else (e.stdout or ""),
            stderr=(e.stderr or b"").decode(errors="replace") if isinstance(e.stderr, bytes) else (e.stderr or ""),
            exit_code=-1,
            duration_s=time.monotonic() - started,
            timed_out=True,
        )
    return Result(
        stdout=completed.stdout,
        stderr=completed.stderr,
        exit_code=completed.returncode,
        duration_s=time.monotonic() - started,
    )
