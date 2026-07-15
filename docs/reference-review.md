# Reference Review

Three mature public orchestration projects were reviewed before selecting this improvement.

## LangGraph

Adopted: explicit state/control boundaries, durable-execution thinking, and human oversight as first-class architecture concerns.

Not adopted: framework dependency, persistence backend, graph runtime, or hosted observability.

## CrewAI

Adopted: separate role definitions from controlled workflow execution, and keep conditional flow logic explicit rather than hidden inside agent prose.

Not adopted: autonomous crews, delegation loops, tools, or framework-specific configuration.

## Microsoft AutoGen / Agent Framework direction

Adopted: provider credentials from the server environment, bounded iterations, and a clear warning that external tools must be trusted and production deployments need their own security controls.

Not adopted: MCP servers, code execution, multi-process agents, AutoGen Studio, or migration to a heavy agent framework.

## Resulting decision

The smallest useful improvement was not adding more autonomous agents. It was making the existing system inspectable and safe: normal source files, deterministic validated routing, server-only provider access, bounded fallback, tests, and CI.
