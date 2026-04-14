# Roadmap

Each stage keeps the same escape-test suite. The tests' *assertion* flips from "attack succeeded" to "attack blocked" as layers come in.

## Stage 0 — naked exec ✅ (current)
- `runner/naked.py`: `subprocess.run(["python", "-c", code])`.
- Every attack lands. The test suite exists to *prove* it.
- Goal: feel the threat model in your hands before defending.

## Stage 1 — bubblewrap jail ✅ (current)
Instead of hand-rolling `unshare`/`chroot`/`clone3`, we use **bubblewrap** — the same sandbox primitive Flatpak and Chromium's renderer use. It stacks, in one binary: user / mount / net / pid / ipc / uts / cgroup namespaces, read-only binds of system dirs, tmpfs `/tmp` and `/home`, `--die-with-parent`, `--new-session`. On top we add env scrubbing, rlimits (applied inside the sandbox so they survive the uid mapping), and a parent-enforced wall-clock timeout.

**Result:** 5 of 6 attacks blocked. Deferred:
- Fork/proc cap → Stage 1b (cgroup v2 `pids.max`; rlimit NPROC is unreliable across nested user ns).

## Stage 1b — cgroup v2 resource caps
- Create a per-run sub-cgroup under `/sys/fs/cgroup/<uuid>`.
- Set `pids.max`, `memory.max`, `cpu.max` before exec.
- Add the bwrap pid to `cgroup.procs`.
- Flip `test_fork_spawn[jail]` from xfail to pass.
- Add new escape tests for OOM and CPU runaway that cgroups will catch.

## Stage 1c — seccomp-bpf allowlist
- Write a minimal syscall policy for Python (via `libseccomp` or a tiny C helper).
- Start from deny-all, add back syscalls Python actually makes (`strace` to discover).
- New escape test: attempting a blocked syscall (e.g. `unshare`, `ptrace`) → killed by seccomp.

## Stage 2 — real sandbox runtime (weekend)
Rewrite using one of:
- **gVisor (runsc)** — userspace kernel, easiest drop-in.
- **Firecracker** — microVMs. Realistic, more work.
- **WebAssembly (Wasmtime + Pyodide)** — capability-based, very different model.

Compare cold-start, overhead, DX. Write up tradeoffs. This comparison is the interview question.

## Stage 3 — production concerns (weekend)
- Warm pool to amortize cold start.
- Stdin/stdout protocol + size limits.
- Structured observability: OTel traces, Prometheus metrics (runs/sec, p50/p95/p99 latency, denial events, OOM events).
- Load test with `k6` or `locust`.
- Wire into `try-pinch` behind a feature flag.

## Stage 4 — wire into Pinch (optional)
- Add `compute_ephemeris` and `analyze_user_history` as tools on the Gemini agent.
- Feature-flag on for your own phone number first.
- Dashboard + alert on denial events.
