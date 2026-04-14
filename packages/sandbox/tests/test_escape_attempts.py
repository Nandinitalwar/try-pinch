"""Escape-attempt suite, parameterized over runners.

Each test runs twice:
  - against the naked Stage 0 runner — attack MUST succeed (baseline proof).
  - against the Stage 1 bwrap jail    — attack MUST be blocked.

The jail runner is skipped automatically if `bwrap` isn't installed (macOS
host). Run the container (`make docker-test`) to exercise both.

Design rules:
- Never actually damage the host.
- Prove capability (or its absence) with small, self-contained attacks.
"""
from __future__ import annotations

import shutil
import socket
import textwrap

import pytest

from runner import jail_run, naked_run

RUNNERS: list = [pytest.param(("naked", naked_run, False), id="naked")]
if shutil.which("bwrap"):
    RUNNERS.append(pytest.param(("jail", jail_run, True), id="jail"))


@pytest.fixture(params=RUNNERS)
def runner(request):
    name, fn, sandboxed = request.param
    return name, fn, sandboxed


# ---------------------------------------------------------------------------
# 1. Secret theft — read an env var the runner inherited.
# ---------------------------------------------------------------------------
def test_read_env_secret(runner, monkeypatch):
    _, run, sandboxed = runner
    monkeypatch.setenv("FAKE_SUPABASE_KEY", "sk-pretend-this-is-real")
    code = "import os; print(os.environ.get('FAKE_SUPABASE_KEY', 'MISSING'))"

    result = run(code)

    if sandboxed:
        assert "sk-pretend-this-is-real" not in result.stdout
        assert "MISSING" in result.stdout
    else:
        assert "sk-pretend-this-is-real" in result.stdout


# ---------------------------------------------------------------------------
# 2. Filesystem write — create a file outside any sandbox scratch dir.
# ---------------------------------------------------------------------------
def test_write_outside_scratch(runner, tmp_path):
    _, run, sandboxed = runner
    target = tmp_path / "pwned.txt"
    code = textwrap.dedent(f"""
        try:
            with open({str(target)!r}, "w") as f:
                f.write("owned")
            print("WROTE")
        except Exception as e:
            print("BLOCKED", type(e).__name__)
    """)

    run(code)

    if sandboxed:
        # Host file must NOT exist — sandbox's /tmp is a tmpfs, host path invisible.
        assert not target.exists()
    else:
        assert target.exists() and target.read_text() == "owned"


# ---------------------------------------------------------------------------
# 3. Filesystem read — read a file the host owns.
# ---------------------------------------------------------------------------
def test_read_host_file(runner, tmp_path):
    _, run, sandboxed = runner
    secret_file = tmp_path / "host_secret.txt"
    secret_file.write_text("TOP_SECRET_VALUE")

    code = textwrap.dedent(f"""
        try:
            print(open({str(secret_file)!r}).read())
        except Exception as e:
            print("BLOCKED", type(e).__name__)
    """)
    result = run(code)

    if sandboxed:
        assert "TOP_SECRET_VALUE" not in result.stdout
        assert "BLOCKED" in result.stdout
    else:
        assert "TOP_SECRET_VALUE" in result.stdout


# ---------------------------------------------------------------------------
# 4. Network egress — resolve a public domain.
# ---------------------------------------------------------------------------
def test_network_egress(runner):
    _, run, sandboxed = runner
    try:
        socket.gethostbyname("example.com")
    except Exception:
        pytest.skip("test host has no network; can't meaningfully test egress")

    code = textwrap.dedent("""
        import socket
        try:
            ip = socket.gethostbyname("example.com")
            print("RESOLVED", ip)
        except Exception as e:
            print("BLOCKED", type(e).__name__)
    """)
    result = run(code)

    if sandboxed:
        assert "BLOCKED" in result.stdout
        assert "RESOLVED" not in result.stdout
    else:
        assert "RESOLVED" in result.stdout


# ---------------------------------------------------------------------------
# 5. Fork / process spawn.
# ---------------------------------------------------------------------------
def test_fork_spawn(runner, request):
    """Attack: keep children alive to drive up concurrent proc count.

    Real fork bombs don't reap — they recurse. RLIMIT_NPROC is meant to cap
    concurrent procs per uid, but in a Docker-on-macOS user namespace the
    kernel's user_struct accounting across uid mappings is unreliable, so
    this attack can slip past rlimits alone. Stage 1b will add cgroup v2
    pids.max, which is the canonical (and reliable) cap.
    """
    _, run, sandboxed = runner
    if sandboxed:
        request.applymarker(pytest.mark.xfail(
            reason="Stage 1b: cgroup pids.max needed — rlimit NPROC unreliable in nested user ns",
            strict=True,
        ))
    code = textwrap.dedent("""
        import os, time, sys
        spawned = 0
        pids = []
        try:
            for _ in range(5):
                pid = os.fork()
                if pid == 0:
                    time.sleep(0.5)  # stay alive so concurrent count climbs
                    os._exit(0)
                spawned += 1
                pids.append(pid)
            for p in pids:
                os.waitpid(p, 0)
            print("SPAWNED", spawned)
        except Exception as e:
            for p in pids:
                try: os.waitpid(p, 0)
                except: pass
            print("BLOCKED", type(e).__name__, "spawned=", spawned)
    """)

    result = run(code)

    if sandboxed:
        # NPROC=3 (MAX_PROCS) → parent + 2 concurrent children allowed; 3rd fork fails.
        assert "SPAWNED 5" not in result.stdout
        assert "BLOCKED" in result.stdout
    else:
        assert "SPAWNED 5" in result.stdout


# ---------------------------------------------------------------------------
# 6. Hang — run longer than the jail's default wall-clock budget.
# ---------------------------------------------------------------------------
def test_hang(runner):
    _, run, sandboxed = runner
    code = "import time; time.sleep(2); print('DONE')"

    result = run(code)  # caller passes no timeout

    if sandboxed:
        # Jail enforces a default wall-clock cap regardless of caller.
        assert result.timed_out is True
        assert "DONE" not in result.stdout
    else:
        assert result.duration_s >= 2.0 and "DONE" in result.stdout
