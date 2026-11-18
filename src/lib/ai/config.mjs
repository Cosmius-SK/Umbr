const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 512;

function normalizeLoopbackUrl(value) {
  const raw = value.trim();
  const rawParts = raw.match(/^http:\/\/([^/?#]*)([^?#]*)/i);
  if (!rawParts || rawParts[1].includes("@")) return null;

  try {
    const url = new URL(raw);
    const valid = (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      !raw.includes("?") &&
      !raw.includes("#") &&
      (rawParts[2] === "" || rawParts[2] === "/") &&
      (url.pathname === "/" || url.pathname === "")
    );
    return valid ? url.origin : null;
  } catch {
    return null;
  }
}

export function readAIConfig(env = process.env) {
  const provider = (env.AI_PROVIDER || "ollama").trim().toLowerCase();
  const configuredBaseUrl = (env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).trim();
  const canonicalBaseUrl = normalizeLoopbackUrl(configuredBaseUrl);
  const baseUrl = canonicalBaseUrl || DEFAULT_BASE_URL;
  const model = (env.OLLAMA_MODEL || "").trim();
  const enabledSetting = (env.EM_AI_ENABLED || "false").trim().toLowerCase() === "true";
  const timeoutCandidate = Number.parseInt(env.OLLAMA_TIMEOUT_MS || "", 10);
  const timeoutMs = Number.isFinite(timeoutCandidate)
    ? Math.min(120_000, Math.max(1_000, timeoutCandidate))
    : DEFAULT_TIMEOUT_MS;

  let availability;
  if (
    provider !== "ollama" ||
    !canonicalBaseUrl ||
    /(?:^|[-_:])cloud(?:$|[-_:])/i.test(model)
  ) availability = "misconfigured";
  else if (env.VERCEL === "1") availability = "hosted_disabled";
  else if (env.NODE_ENV === "production") availability = "production_disabled";
  else if (!enabledSetting) availability = "disabled";
  else if (!model) availability = "needs_model";
  else availability = "local_enabled";

  return {
    provider: provider === "ollama" ? "ollama" : provider,
    enabled: availability === "local_enabled",
    baseUrl,
    model,
    timeoutMs,
    maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
    availability,
  };
}

export function publicAvailability(config) {
  const messages = {
    hosted_disabled:
      "Hosted inference is disabled. The conversation interface is available, but AI replies require local development with Ollama.",
    production_disabled:
      "AI inference is disabled in production. Em's conversation interface remains available without a model.",
    disabled:
      "Local AI inference is disabled. Enable it in your local environment after configuring an already-installed Ollama model.",
    misconfigured:
      "Local AI inference configuration is invalid. Check the local provider and loopback address settings.",
    needs_model:
      "Local AI inference is enabled, but no model name is configured. Set OLLAMA_MODEL to an already-installed model.",
    local_enabled:
      "Local Ollama inference is configured for development. The service is checked when you send a message.",
  };
  return { availability: config.availability, message: messages[config.availability] };
}
