# Sandboxed Code Execution — Design

## 1. Context

Today Pinch's agent has two tools: `search_web` (Exa) and `save_birth_data` (Supabase). Both run in-process with full access to env vars, the Supabase service key, the network, and the host filesystem.

We're adding two sandboxed tools:

- `compute_ephemeris(code)` — chart / transit / aspect math via `pyswisseph` / `skyfield`.
- `analyze_user_history(code)` — summaries over the requesting user's own rows.

This expands the trust boundary two ways:

1. **LLM-authored code** now runs on our infra.
2. **Attacker-controlled content** (Exa search results) influences what code the LLM writes.

Without isolation, a single prompt-injection payload in a crawled blog post could exfiltrate `SUPABASE_SERVICE_KEY` or one user's chart data.

## 2. Trust boundaries

| Principal | Trusted for | Not trusted for |
|---|---|---|
| Our application code | Everything | — |
| Gemini (the model) | Following system prompt under normal input | Following it under adversarial input |
| Exa search results | Being roughly relevant | Being free of injection payloads |
| User SMS/WhatsApp input | Being a question | Being benign |
| Code inside the sandbox | Doing astro math / analysis | Accessing secrets, network, other users' data, host fs |

## 3. Threat model

**Attacker capabilities:**
- Publish web pages that Exa may return.
- Send SMS/WhatsApp messages to Pinch.
- Indirectly cause Gemini to emit arbitrary Python into a sandbox tool.

**Attacker goals (priority order):**
1. Credential theft — read `SUPABASE_SERVICE_KEY`, Twilio token, Gemini key from env.
2. Cross-tenant data access — read another user's chart or history.
3. Data exfiltration — POST stolen data to an attacker endpoint.
4. Host compromise — escape to the worker, persist, pivot.
5. Resource abuse — crypto-mine, fork-bomb, fill disk.
6. Denial of service — hang workers, OOM the host.

**Out of scope:** supply-chain attacks on `pyswisseph`, side-channels between sandbox instances, insider threat.

## 4. Architecture

```
Twilio webhook
    ↓
Next.js API route  (trust: high, holds keys)
    ↓
Agent loop (Gemini)
    │
    ├── compute_ephemeris(code)
    │        ↓  RPC boundary
    │      Sandbox "ephemeris"
    │        no net, no fs writes, no env, no stdin
    │        128 MB / 0.5 CPU / 2 s
    │        libs: pyswisseph, skyfield
    │
    └── analyze_user_history(code)
             ↓  RPC boundary
           Sandbox "analysis"
             no net, no fs writes, no env
             stdin = this user's history JSON
             256 MB / 1 CPU / 5 s
             libs: pandas, numpy
    ↓
Reply to user
```

The API process is the only component with credentials; neither sandbox can reach Supabase, Twilio, or Gemini.

## 5. Defense in depth

| Layer | Mechanism | Defeats |
|---|---|---|
| L1 Input validation | Max code + stdin size, syntactic pre-check | Trivial DoS |
| L2 Isolation | gVisor (runsc) — userspace kernel | Kernel-exploit escapes |
| L3 Filesystem | Read-only rootfs, tmpfs /tmp, no host mounts | Reading /etc, writing persistence |
| L4 Network | Empty net namespace (no loopback to internal services) | Exfiltration, SSRF |
| L5 Syscalls | seccomp-bpf allowlist | Unknown gVisor bugs |
| L6 Capabilities | Drop all; uid 65534 in user namespace | Privilege escalation |
| L7 Resources | cgroups v2: mem, CPU, pids, wall | Fork bomb, OOM, hang |
| L8 Secrets hygiene | Scrubbed environ; keys live only in API | Env theft even if L2–L7 fail |
| L9 Data I/O | Only stdin/stdout; no shared mount; no DB creds in sandbox | Cross-tenant data access |
| L10 Observability | Log duration, exit, rss peak, seccomp denials | Detecting novel attacks |

**The load-bearing line is L9.** Even if every other layer fails, the sandbox has no credentials to Supabase, so cross-tenant theft requires compromising the API process, not just the sandbox.

## 6. Data flow for the analysis case

`analyze_user_history` is the only sandbox that touches user data:

1. User asks: *"what patterns do you see in my last 6 months?"*
2. Agent calls `analyze_user_history(code)`.
3. API process authenticates the user by phone, fetches *only that user's* rows.
4. API serializes rows to JSON, launches the sandbox with JSON on stdin.
5. Sandbox runs LLM-written pandas code, writes summary to stdout.
6. API returns stdout to the agent → reply.

Cross-tenant isolation is enforced in the API layer (trusted) via row scoping, not in the sandbox (untrusted). Trust boundary = credential boundary = data-scoping boundary, all at the API.

`compute_ephemeris` never touches user data; its stdin channel is disabled entirely.

## 7. Residual risks

- **gVisor 0-day.** We're trusting Google's userspace kernel. If broken, L7 still caps damage and L9 still blocks cross-tenant theft.
- **Cold start.** gVisor adds ~100–300 ms. Mitigated by a warm pool in Stage 3.
- **Injection via non-code tool calls.** Prompt injection can still make the agent call `save_birth_data` with weird args. Separate mitigation: argument validation on every tool call.

## 8. Success metrics

- **Correctness:** the full escape-attempt suite (`tests/`) blocks every attack by end of Stage 1.
- **Performance:** p95 sandbox overhead <250 ms with warm pool; <5 s end-to-end reply.
- **Reliability:** sandbox failure rate <0.5%; every failure logged with trace ID.
- **Observability:** dashboard of runs/sec, p50/p95/p99 latency, denial events, OOM events.

## 9. Rollout

1. Ship behind a feature flag, both tools disabled.
2. CI runs the escape-attempt suite on every change.
3. Enable for developer phone numbers; dogfood for a week.
4. Enable for beta users; watch denial/error dashboard.
5. Enable broadly.
