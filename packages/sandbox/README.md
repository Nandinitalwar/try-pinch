# pinch-sandbox

A sandboxed code-execution service for the Pinch agent (and a learning exercise in building real sandboxes from Linux primitives up).

**Status: Stage 1 — bubblewrap jail.** Two runners coexist in `runner/`: `naked_run` (unsafe baseline, Stage 0) and `jail_run` (bubblewrap + namespaces + tmpfs rootfs + scrubbed env + rlimits + wall-clock cap). The escape suite runs against both, asserting attacks land against `naked` and are blocked by `jail`.

Current score (inside the Linux container): **11 passed, 1 xfailed** — 5 of 6 attacks blocked by the jail.

| Attack | naked (Stage 0) | jail (Stage 1) | Defense |
|---|---|---|---|
| Read env secret | lands | **blocked** | env scrubbed before exec |
| Write outside scratch | lands | **blocked** | tmpfs rootfs; host `/tmp` invisible |
| Read host file | lands | **blocked** | read-only binds hide host tmp_path |
| Network egress | lands | **blocked** | empty net namespace (`--unshare-all`) |
| Fork spawn | lands | *xfail* | deferred to Stage 1b (cgroup `pids.max`) |
| Hang without caller timeout | lands | **blocked** | parent enforces default 1 s wall cap |

Fork/proc-count is xfail because `RLIMIT_NPROC` is unreliable across nested user namespaces on Docker-on-macOS (the kernel's `user_struct` accounting doesn't track mapped uids cleanly). Cgroup v2 `pids.max` is the canonical fix and lands in Stage 1b.

## Why this exists

Pinch's agent (see `../api`) has tools that run on trusted infrastructure with access to Supabase, Twilio, and Gemini credentials. Adding LLM-authored code execution (`compute_ephemeris`, `analyze_user_history`) expands the trust boundary in two ways:

1. **LLM-authored code** runs on our infra.
2. **Attacker-controlled content** (Exa search results) influences what the LLM writes.

A prompt-injection payload in a crawled astrology blog could otherwise cause the agent to emit Python that reads `SUPABASE_SERVICE_KEY` and POSTs it to an attacker endpoint. The sandbox exists to contain that blast radius.

Full design doc: [`docs/design.md`](docs/design.md).

## Layout

```
runner/           the sandbox runners themselves, one per stage
  naked.py        Stage 0 — no isolation
tests/            escape-attempt tests (pytest)
  test_escape_attempts.py
docs/
  design.md       threat model + architecture
Dockerfile        Linux dev/test environment (required from Stage 1 onward)
```

## Running the tests

### On macOS (naked runner only)
```
pip install -r requirements.txt
pytest -v
```
Exercises the 6 attacks against the naked runner — all pass, meaning all attacks land. Good for watching the baseline fail.

### Inside Linux (both runners)
```
make docker-test
```
Runs everything against both runners. The jail runner requires `bubblewrap`, a Linux kernel with unprivileged user namespaces, and (inside Docker) `seccomp:unconfined` + `SYS_ADMIN` on the outer container — see `docker-compose.yml`.

## Tools exposed to the agent

Two narrow tools, each with its own resource profile and contract:

| Tool | Purpose | Stdin | Libraries | Limits |
|---|---|---|---|---|
| `compute_ephemeris(code)` | Chart / transit / aspect math | none | `pyswisseph`, `skyfield` | 128 MB / 0.5 CPU / 2 s |
| `analyze_user_history(code)` | Summaries over the requesting user's rows | user's history JSON | `pandas`, `numpy` | 256 MB / 1 CPU / 5 s |

Neither sandbox holds credentials. Only `analyze_user_history` sees user data, and only the requesting user's — the API layer scopes the query before piping JSON to stdin.

## Roadmap

See [`ROADMAP.md`](ROADMAP.md). Stages 0 → 3 stack isolation layers while keeping the same test suite as the correctness contract.
