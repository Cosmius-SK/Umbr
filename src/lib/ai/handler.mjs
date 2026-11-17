import { readAIConfig, publicAvailability } from "./config.mjs";
import { AIProviderError, publicError } from "./errors.mjs";
import { createOllamaAdapter } from "./ollama-adapter.mjs";
import { MAX_REQUEST_BYTES, validateConversationRequest } from "./request-validation.mjs";
import { streamConversation } from "../conversation/orchestrator.mjs";

const encoder = new TextEncoder();

function jsonResponse(value, status = 200) {
  return Response.json(value, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

async function readBoundedText(request) {
  if (!request.body) return { ok: true, text: "" };
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return { ok: false };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false };
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false };
  }
}

function disabledResponse(config) {
  if (config.availability === "needs_model") {
    return jsonResponse({ error: { code: "model_not_configured", message: "No local model is configured. Set OLLAMA_MODEL to an already-installed model." } }, 503);
  }
  if (config.availability === "misconfigured") {
    return jsonResponse({ error: { code: "configuration_invalid", message: "Local AI configuration is invalid. Check the development environment settings." } }, 503);
  }
  const availability = publicAvailability(config);
  return jsonResponse({
    error: {
      code: "inference_disabled",
      message: config.availability === "hosted_disabled" || config.availability === "production_disabled"
        ? availability.message
        : "Local AI inference is disabled. Enable it in your local environment after configuring an already-installed Ollama model.",
    },
  }, 503);
}

function publicResponseStream(messages, adapter, request) {
  const abortController = new AbortController();
  const abortFromRequest = () => abortController.abort();
  if (request.signal.aborted) abortController.abort();
  else request.signal.addEventListener("abort", abortFromRequest, { once: true });

  const body = new ReadableStream({
    async start(controller) {
      const send = (event) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        for await (const event of streamConversation(messages, adapter, abortController.signal)) {
          send(event);
        }
      } catch (error) {
        if (!abortController.signal.aborted) send({ type: "error", error: publicError(error) });
      } finally {
        request.signal.removeEventListener("abort", abortFromRequest);
        try {
          controller.close();
        } catch {
          // The browser may have closed the stream.
        }
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function handleConversationRequest(
  request,
  { env = process.env, fetchImpl = fetch } = {},
) {
  const config = readAIConfig(env);
  if (request.method === "GET") return jsonResponse(publicAvailability(config));
  if (request.method !== "POST") {
    return jsonResponse({ error: { code: "invalid_request", message: "Use POST to send a conversation message." } }, 405);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ error: { code: "invalid_request", message: "Send conversation data as JSON." } }, 415);
  }

  const bodyText = await readBoundedText(request);
  if (!bodyText.ok) {
    return jsonResponse({ error: { code: "payload_too_large", message: "The conversation request is too large or is not valid UTF-8." } }, 413);
  }
  let body;
  try {
    body = JSON.parse(bodyText.text);
  } catch {
    return jsonResponse({ error: { code: "invalid_request", message: "The conversation request is not valid JSON." } }, 400);
  }
  const validation = validateConversationRequest(body);
  if (!validation.ok) {
    return jsonResponse({ error: { code: "invalid_request", message: validation.message } }, 400);
  }
  if (!config.enabled) return disabledResponse(config);

  try {
    const adapter = createOllamaAdapter(config, fetchImpl);
    return publicResponseStream(validation.messages, adapter, request);
  } catch (error) {
    const safe = publicError(error instanceof AIProviderError ? error : new AIProviderError("provider_error"));
    return jsonResponse({ error: safe }, 500);
  }
}
