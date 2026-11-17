# Project Umbr

Project Umbr is an evolving AI ecosystem. Its first AI entity is Embr, commonly called Em.

## Em

The initial application page identifies **Em** (formal identity: **Embr**) and introduces Em with “I'm Em.” The confirmed identity and character decisions are documented in [Em Identity Core v0.1](docs/identity/Em-Identity-Core-v0.1.md). The page is a static identity screen; it does not implement conversation or AI capabilities.

## Development setup

Use a maintained Node.js LTS release. Node.js 26 LTS is the recommended development and deployment runtime; supported project runtimes are Node.js 22, 24, and 26 LTS. Next.js 16 requires Node.js 20.9 or later. Node 20 is end-of-life, is not supported by this project for normal development, and is not suitable for production. The existing Node.js 20.15.1 runtime may be used only for temporary compatibility checks. A local production-build check on that runtime failed while processing CSS, including a CSS/PostCSS worker startup error and an `ERR_REQUIRE_ESM` error during a webpack diagnostic. This result is inconclusive because Node 20.15.1 is outside the project's supported runtime range; validate the production build on Node.js 26 before diagnosing the cause.

Install Node.js using a method appropriate for your operating system from the [official Node.js downloads page](https://nodejs.org/en/download/), then verify the runtime:

```sh
node --version
npm --version
```

Clone the repository and install the exact dependency tree from the committed npm lockfile:

```sh
git clone https://github.com/Cosmius-SK/Umbr.git
cd Umbr
npm ci
```

These instructions apply to Windows, macOS, and Linux. No global project CLI is needed. Start the local development server with:

```sh
npm run dev
```

Open the local URL printed by Next.js. Before submitting changes, run:

```sh
npm run typecheck
npm run build
```

There are no application environment variables yet, so an `.env.example` file is not needed. If a future integration adds configuration, document variable names there and keep real credentials in an ignored local environment file or the deployment provider's secret settings.

## Technology

- Next.js App Router, React, and TypeScript
- Tailwind CSS 4 through its local PostCSS plugin
- npm with exact direct dependency pins and a committed `package-lock.json`
- Node.js 22, 24, or 26 LTS for supported development; Node.js 26 LTS for CI and deployment

The application, model integration, database, authentication, and deployment integrations are not part of this scaffold.
