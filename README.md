# PES Master Orchestrator

A controlled, source-visible AI orchestration application built with Next.js. It classifies a business request with a deterministic 12-agent router, validates the route, and then sends one bounded request through a server-side provider gateway.

The original uploaded snapshot remains in `MASTER-ORCHESTRATOR-OPTIMIZED.zip` for provenance. The maintained application now lives in normal source files so changes can be reviewed, tested, and deployed safely.

## What changed

- Provider credentials moved out of the browser and into server environment variables.
- Direct browser calls to Anthropic, OpenAI, Groq, Together, Gemini, and Ollama were removed.
- Routing is deterministic and schema-validated; model output cannot choose arbitrary agents.
- Provider fallback is bounded by a timeout and a maximum attempt count.
- Ollama accepts loopback HTTP addresses only, preventing arbitrary server-side requests.
- Demo mode is explicit and clearly labelled as non-AI.
- Model responses are rendered as plain text and never trigger external actions.
- Tests, dependency audit, security regression checks, and CI are now part of the repository.

## Architecture

```text
Browser UI
  -> POST /api/orchestrate
     -> validate request
     -> deterministic router (1–3 known agents)
     -> server-side provider gateway
     -> bounded response
  <- validated route + provider metadata + plain-text answer
```

The router contains 12 role definitions: Marketing, E-Commerce, Software Development, Content, Data Analytics, Sales, Customer Service, Finance, Human Resources, Design, Project Management, and Social Media.

## Local setup

Requirements: Node.js 20 or newer.

```bash
npm install --ignore-scripts --no-audit --no-fund
cp .env.example .env.local
npm run dev
```

Direct dependency versions are exact. CI audits the complete resolved graph on every run. A generated lockfile containing environment-specific internal registry URLs is deliberately not published.

Configure at least one provider with both its API key and model name. No default paid model is assumed.

For an offline UI smoke test without a provider:

```bash
ORCHESTRATOR_DEMO_MODE=true npm run dev
```

Demo mode returns a fixed, clearly labelled response. It does not call a model.

## Provider configuration

Supported server-side providers:

- Anthropic
- OpenAI
- Groq
- Together AI
- Google Gemini
- local Ollama

The status endpoint returns provider names and readiness only. It never returns keys or model names.

See [OLLAMA-GUIDE.md](OLLAMA-GUIDE.md) for local Ollama setup.

## Verification

```bash
npm run check
npm run security-check
npm audit --omit=dev --audit-level=moderate
NEXT_TELEMETRY_DISABLED=1 ORCHESTRATOR_DEMO_MODE=true npm run build
```

Verified baseline:

- 16 unit tests
- production Pages Router build
- dependency audit with zero known vulnerabilities at the time of verification
- no browser credential storage or direct client-side provider endpoints

## Security boundaries

This project is a decision-support interface, not an autonomous execution system. It does not publish posts, send messages, run shell commands, access MCP tools, or change external systems. Model output remains untrusted text.

Before public deployment, add authentication, per-user authorization, rate limiting, abuse controls, request logging with privacy redaction, and provider-specific data-retention review. See [docs/security-audit.md](docs/security-audit.md).

## Documentation

- [Architecture and behavior](docs/architecture.md)
- [Archive inventory](docs/archive-inventory.md)
- [Reference review](docs/reference-review.md)
- [Security audit](docs/security-audit.md)
