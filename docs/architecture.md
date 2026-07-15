# Architecture

## Control plane

The browser submits a bounded request to `pages/api/orchestrate.js`. The API validates the body, derives a deterministic routing decision, constructs a role-specific safety prompt, and calls the server-side gateway.

Routing is not delegated to a model. `lib/orchestration/router.mjs` returns one to three IDs from a fixed registry and validates complexity and priority values before execution.

## Provider gateway

`lib/orchestration/gateway.mjs` owns all provider credentials and endpoints. A provider is available only when its key and explicit model are configured. The gateway:

- uses fixed provider URLs;
- restricts Ollama to loopback HTTP;
- caps response bodies at 1 MB and response text at 20,000 characters;
- bounds timeouts to 1–60 seconds;
- bounds attempts to 1–5;
- validates provider JSON and normalizes public failures;
- never returns credentials or configured model names to the browser.

## State and side effects

Conversation state is session-local React state and can be exported by the user. It is not silently persisted. There are no tools, command execution, publishing, messaging, or external mutations.

Durable job state, human approvals, and trusted tool execution are intentionally future capabilities rather than implicit behavior in this baseline.
