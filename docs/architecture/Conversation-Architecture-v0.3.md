# Em Conversation Architecture v0.3

## Request flow

The browser keeps the transcript in tab-scoped `sessionStorage` and submits only to `POST /api/conversation`. It never calls an inference endpoint directly.

The Next.js Route Handler bounds the request body, validates message count, length, and roles, and refuses user-supplied system messages. The conversation orchestrator maps creator and Em messages to provider-neutral user and assistant roles and prepends the server-owned Em identity instructions. It then calls the `ModelAdapter` streaming contract.

The initial adapter is Ollama. It accepts loopback URLs only, checks `/api/tags` for the configured model before generation, and streams `/api/chat` NDJSON deltas. It has no model-download path. The API translates provider failures into a small set of safe error messages and streams only text deltas, completion, or normalized errors to the browser.

## Boundaries

- **Conversation UI:** manages the draft, transcript rendering, session history, stream progress, cancellation, and user-visible status.
- **Conversation API:** bounds and validates requests, controls streaming, cancellation, and safe errors.
- **Em identity:** server-only instructions based on the twelve approved v0.1 decisions.
- **Conversation orchestration:** constructs identity-first model context and depends only on the provider-neutral adapter contract.
- **Model abstraction:** defines messages, generation requests/events, configuration, capabilities, normalized errors, and cancellation.
- **Provider adapter:** maps the abstraction to a local provider protocol; currently only Ollama.
- **Model configuration:** reads server-side environment values and keeps inference disabled unless explicitly enabled in local development.

No database, authentication, provider registry, agent framework, tool execution, or remote inference service is included.

## Runtime policy

`EM_AI_ENABLED` defaults to `false`. The adapter only accepts `localhost`, `127.0.0.1`, or `::1`; Ollama cloud model names and non-loopback URLs are rejected. The configured model must appear in the local model list before a chat request is sent. Ollama is not installed and models are not downloaded by the application.

Inference is disabled whenever `NODE_ENV=production` or the `VERCEL=1` marker is present. The UI and production build do not require Ollama, model credentials, or provider availability. Vercel's loopback address is not used to reach a developer's machine, and no tunnel or public endpoint is supported.

## Wire protocol and safeguards

The conversation API accepts JSON containing 1–100 messages, each 1–2,000 characters, with a total request cap of 256,000 bytes. Only `creator` and `em` are accepted from the browser, and the latest message must be from the creator. Generation uses a maximum of 512 output tokens and a configurable timeout capped at two minutes. The request abort signal is forwarded to provider fetch and stream reads.

The browser receives newline-delimited JSON events containing text deltas, completion, or normalized safe errors. Provider URLs, stack traces, model configuration, and raw upstream errors are not returned. Tests use mocked HTTP responses; CI does not need Ollama, a GPU, or downloaded model files.
