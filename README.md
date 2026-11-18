# Project Umbr

Project Umbr is an evolving AI ecosystem. Its first AI entity is Embr, commonly called Em.

## Em

The application identifies **Em** (formal identity: **Embr**) and opens with “I'm Em.” The confirmed identity and character decisions are documented in [Em Identity Core v0.1](docs/identity/Em-Identity-Core-v0.1.md).

## Model-independent conversation

Em's browser interface talks only to the Next.js conversation API. The server validates conversation messages, adds Em's approved identity instructions, and calls a provider-neutral streaming interface. The initial adapter uses the Ollama HTTP API on the same computer as the development server. The interface and identity instructions do not depend on Ollama-specific code.

AI inference is disabled by default. The application does not install Ollama, download models, call hosted inference providers, or require Ollama for tests or builds. When no model is available, the conversation UI remains usable and clearly reports why Em cannot generate a reply.

## Development setup

Use a supported Node.js LTS release and npm. Node.js 26 LTS is the recommended development runtime and is used in CI. The project also supports Node.js 22 and 24 LTS. Node 20 is end-of-life and is not supported for normal project development or production.

Clone the repository and install the committed dependency tree:

```sh
git clone https://github.com/Cosmius-SK/Umbr.git
cd Umbr
npm ci
npm test
npm run typecheck
npm run build
npm run dev
```

Open the local URL printed by Next.js. Project commands use local dependencies; no global CLI package is needed. `npm ci`, tests, typecheck, and production build do not require Ollama or an inference service.

## Optional local Ollama inference

Ollama must already be installed and running on the same computer as the Next.js development server. The application will not install Ollama or fetch a model. Check the models already installed locally with `ollama list`, then copy `.env.example` to `.env.local` and set `OLLAMA_MODEL` to an exact installed model name. In PowerShell, copy it with `Copy-Item .env.example .env.local`; on macOS or Linux, use `cp .env.example .env.local`. For example:

```dotenv
AI_PROVIDER=ollama
EM_AI_ENABLED=true
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=your-installed-local-model-name
OLLAMA_TIMEOUT_MS=60000
```

Keep `EM_AI_ENABLED=false` to leave inference off. The adapter accepts loopback URLs only, checks the local model list before generation, and does not call Ollama's model pull endpoint. Ollama cloud model names are rejected. The application sends prompts from the browser to its own Next.js server, which sends them to the local Ollama process only when local development inference is enabled. Session history remains tab-scoped in `sessionStorage`; there is no database or long-term memory.

To change models, select another exact model name already shown by `ollama list` and update `OLLAMA_MODEL` in `.env.local`; restart the development server. No model is assumed to be present, and no model download is started by this project.

## Hosted deployment and security

Hosted inference is disabled in production, including on Vercel. A Vercel server cannot reach Ollama running on a developer's computer through `127.0.0.1`; this project does not add tunnels, public Ollama access, proxies, hosted inference, or paid services. The production build and deployment work without an inference provider, local model, or credentials.

The browser never receives the Ollama endpoint or internal provider errors. Requests accept only creator and Em message roles; server-owned system instructions are added after validation and cannot be replaced by browser messages. Request size, history length, message length, output tokens, and provider time are bounded. Only the server-side Ollama adapter knows the loopback endpoint. Do not expose Ollama beyond loopback.

Local inference uses the computer's existing resources and may be slow or unavailable depending on its capabilities and installed model. No new hardware or recurring service cost is required or assumed.

## Technology and validation

- Next.js App Router, React, and TypeScript
- Tailwind CSS 4 through the local PostCSS plugin
- npm with exact direct dependency pins and committed `package-lock.json`
- Node.js 22, 24, or 26 LTS supported; Node.js 26 LTS used by CI
- `npm test`, `npm run typecheck`, and `npm run build`

See [Conversation Architecture v0.3](docs/architecture/Conversation-Architecture-v0.3.md) for component boundaries and request flow.
