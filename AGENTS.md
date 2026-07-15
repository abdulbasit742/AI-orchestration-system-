# AGENTS.md

## Scope

These instructions apply to the entire `abdulbasit742/AI-orchestration-system-` repository.

Project: **PES Master Orchestrator**, a Next.js Pages Router application with a deterministic router and server-side model gateway.

## Source of truth

- Maintain the extracted root source tree.
- Treat `MASTER-ORCHESTRATOR-OPTIMIZED.zip` as a read-only legacy snapshot.
- Do not add provider credentials, populated environment files, or browser credential storage.

## Working method

1. Read `README.md`, `docs/architecture.md`, nearby tests, and the relevant API/client modules before editing.
2. Keep routing deterministic and validate all route/provider IDs at trust boundaries.
3. Keep provider credentials and calls inside `lib/orchestration/gateway.mjs` or another server-only module.
4. Preserve the no-side-effect baseline unless a separately reviewed capability adds authentication, authorization, explicit human approval, and audit logging.
5. Update tests and documentation when behavior, configuration, public APIs, or dependencies change.

## Verified commands

```bash
npm install --ignore-scripts --no-audit --no-fund
npm run check
npm run security-check
npm audit --omit=dev --audit-level=moderate
NEXT_TELEMETRY_DISABLED=1 ORCHESTRATOR_DEMO_MODE=true npm run build
```

## Security requirements

- Never put API keys, secrets, or model credentials in React state, browser storage, URLs, logs, or responses.
- Do not accept arbitrary provider endpoints; Ollama remains loopback-only.
- Bound request sizes, response sizes, timeouts, retries, and fallback attempts.
- Treat model output as untrusted text and never convert it directly into external actions.
- Do not add shell execution, MCP servers, browser automation, publishing, messaging, billing, or destructive operations without explicit authorization and a visible approval boundary.

## Completion checklist

- Relevant tests, security check, dependency audit, and production build pass.
- No secrets or populated environment files are introduced.
- The maintained source—not the ZIP—contains the change.
- Residual risks and new configuration are documented.
