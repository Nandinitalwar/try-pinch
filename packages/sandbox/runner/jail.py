"""Stage 1 runner: bubblewrap-based jail.

Layers added on top of Stage 0 (naked):
  - user, mount, net, pid, ipc, uts, cgroup namespaces (--unshare-all)
  - tmpfs rootfs for /tmp and /home, read-only bind of system dirs
  - scrubbed env — no host env vars leak
  - rlimits: NPROC, CPU, FSIZE
  - parent-enforced wall-clock timeout
  - --die-with-parent to prevent orphaned survivors
  - --new-session to detach controlling tty

What this still does NOT have (deferred to later sub-stages):
  - seccomp-bpf syscall allowlist
  - cgroups v2 memory/CPU caps (we use rlimits here; cgroups are stronger)
  - gVisor / Firecracker (Stage 2)
"""
from __future__ import annotations

import shutil
import subprocess
import time

from .naked import Result

DEFAULT_WALL_TIMEOUT_S = 1.0
MAX_PROCS = 3  # enough for python itself; blocks fork bombs
MAX_CPU_SECONDS = 2
MAX_FILE_BYTES = 1024 * 1024  # 1 MB


_RLIMIT_PRELUDE = f"""
import resource as _r
# Applied inside the sandbox against the sandbox's (mapped) uid. Once lowered,
# cannot be raised without CAP_SYS_RESOURCE, which the sandboxed user lacks.
_r.setrlimit(_r.RLIMIT_NPROC,  ({MAX_PROCS}, {MAX_PROCS}))
_r.setrlimit(_r.RLIMIT_CPU,    ({MAX_CPU_SECONDS}, {MAX_CPU_SECONDS}))
_r.setrlimit(_r.RLIMIT_FSIZE,  ({MAX_FILE_BYTES}, {MAX_FILE_BYTES}))
del _r
"""


def _build_cmd(code: str) -> list[str]:
    cmd = ["bwrap"]
    # Read-only bind the system dirs the Python interpreter needs.
    # --ro-bind-try skips missing sources (e.g. /lib64 on some arches).
    for src in ("/usr", "/usr/local", "/lib", "/lib64", "/bin", "/sbin", "/etc"):
        cmd += ["--ro-bind-try", src, src]
    cmd += [
        # NOTE: bind-mounting the host /proc instead of `--proc /proc`.
        # Mounting a fresh procfs requires SYS_ADMIN on the inner mount ns,
        # which Docker-on-Mac's kernel won't grant even with cap_add. On a
        # bare-metal Linux host we'd use `--proc /proc` for a clean PID view.
        # Correctness tradeoff: sandbox can read host /proc (PID list, cmdlines,
        # but NOT /proc/<pid>/environ of other procs thanks to uid isolation).
        "--ro-bind", "/proc", "/proc",
        "--dev", "/dev",
        "--tmpfs", "/tmp",
        "--tmpfs", "/home",
        "--chdir", "/tmp",
        "--unshare-all",
        # Drop from root-in-userns to nobody. RLIMIT_NPROC isn't enforced for
        # root, so running as uid 65534 is required for the fork cap to bite.
        "--uid", "65534",
        "--gid", "65534",
        "--die-with-parent",
        "--new-session",
        "--",
        "python3", "-c", _RLIMIT_PRELUDE + "\n" + code,
    ]
    return cmd


def run(code: str, stdin: str = "", timeout: float | None = None) -> Result:
    if shutil.which("bwrap") is None:
        raise RuntimeError(
            "bubblewrap (bwrap) is required for the jail runner. "
            "On macOS, run inside the Linux Docker container (see Dockerfile)."
        )
    wall = timeout if timeout is not None else DEFAULT_WALL_TIMEOUT_S
    cmd = _build_cmd(code)
    # Empty, minimal env — no host secrets leak through.
    sandbox_env = {"PATH": "/usr/local/bin:/usr/bin:/bin", "LANG": "C.UTF-8"}

    started = time.monotonic()
    try:
        p = subprocess.run(
            cmd,
            input=stdin,
            capture_output=True,
            text=True,
            timeout=wall,
            env=sandbox_env,
        )
    except subprocess.TimeoutExpired as e:
        stdout = e.stdout.decode(errors="replace") if isinstance(e.stdout, bytes) else (e.stdout or "")
        stderr = e.stderr.decode(errors="replace") if isinstance(e.stderr, bytes) else (e.stderr or "")
        return Result(
            stdout=stdout,
            stderr=stderr,
            exit_code=-1,
            duration_s=time.monotonic() - started,
            timed_out=True,
        )
    return Result(
        stdout=p.stdout,
        stderr=p.stderr,
        exit_code=p.returncode,
        duration_s=time.monotonic() - started,
    )
