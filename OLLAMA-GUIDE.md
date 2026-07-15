# Local Ollama Guide

Ollama support is local and server-side. The browser never connects to Ollama directly, and this repository does not claim or depend on a public hosted Ollama API.

## Install and prepare a model

Install Ollama using its official instructions, then pull a model suitable for your machine. Example:

```bash
ollama pull llama3.2:3b
ollama serve
```

Confirm that the local service is available:

```bash
curl http://127.0.0.1:11434/api/tags
```

## Configure the orchestrator

In `.env.local`:

```dotenv
OLLAMA_ENABLED=true
OLLAMA_MODEL=llama3.2:3b
OLLAMA_BASE_URL=http://127.0.0.1:11434
ORCHESTRATOR_PROVIDER_ORDER=ollama,anthropic,openai,groq,together,gemini,demo
```

Restart the Next.js server after changing environment variables.

## Network boundary

`OLLAMA_BASE_URL` must use plain HTTP on one of these loopback hosts:

- `127.0.0.1`
- `localhost`
- `::1`

Remote URLs are rejected by design. This prevents the API route from becoming a general server-side request proxy.

For a hosted deployment, `localhost` refers to the deployment server—not your laptop. Run Ollama on the same trusted host or private runtime as the Next.js server. Do not expose Ollama directly to the public internet.

## Hardware expectations

Model memory and speed vary significantly. Start with a small model and monitor RAM usage and response latency. The gateway caps each provider request with `ORCHESTRATOR_TIMEOUT_MS` and limits fallback attempts with `ORCHESTRATOR_MAX_PROVIDER_ATTEMPTS`.

## Privacy

Local inference can keep prompts on the machine running Ollama, but the application and hosting environment may still log requests. Review server logs, backups, observability tools, and operating-system access before using sensitive data.
