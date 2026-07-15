# Security Audit — 2026-07-15

## Removed active risks

- API keys stored in browser `localStorage`.
- Direct client requests to third-party model APIs.
- Unsupported claims that Claude required no key or that a public hosted Ollama endpoint was available.
- Arbitrary model-generated routing JSON controlling execution.
- Recursive fallback behavior without a strict provider-attempt cap.
- Remote Ollama URLs that could turn the server into an SSRF proxy.
- Raw internal errors and unbounded provider response bodies.
- Model output rendered or treated as completed external actions.

## Current controls

- 32 KB API body limit and 4,000-character message limit.
- Fixed agent and provider allowlists.
- Deterministic, schema-validated routing.
- Server-only credentials and fixed provider endpoints.
- Loopback-only Ollama.
- Request timeout, response-size cap, and maximum fallback attempts.
- No-store responses and baseline browser security headers.
- Plain-text UI rendering.
- Dependency audit and active-source security scanner in CI.
- Next.js 15.5.18 and a reviewed PostCSS 8.5.10 override; dependency audit was clean at verification time.

## Residual risks

- The API has no authentication, tenancy, rate limiting, or quota enforcement.
- Provider prompts may be retained under provider or hosting policies.
- A model can still produce inaccurate, biased, or unsafe text.
- Server logs and exported conversations may contain user-provided sensitive data.
- The legacy ZIP still contains the old browser-key design; it is retained only as historical provenance and is not the active application.
- There is no durable workflow state or human approval service yet.

## Deployment gate

Do not expose the API publicly until authentication, authorization, rate limiting, privacy-aware logging, abuse monitoring, and provider data-policy review are implemented.
