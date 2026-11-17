import { AIProviderError } from "./errors.mjs";

export const OLLAMA_CAPABILITIES = Object.freeze({
  streaming: true,
  cancellation: true,
  localOnly: true,
  maxOutputTokens: 512,
});

function classifyAbort(error, requestSignal) {
  if (requestSignal.aborted) return new AIProviderError("request_cancelled");
  if (error?.name === "AbortError" || error?.name === "TimeoutError") {
    return new AIProviderError("provider_timeout");
  }
  return new AIProviderError("provider_unavailable");
}

async function* readChatStream(body, abortContext, requestSignal) {
  if (!body) throw new AIProviderError("provider_malformed_response");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const event = parseLine(line);
        if (event) {
          if (event.type === "done") finished = true;
          yield event;
        }
      }

      if (done) break;
    }

    const finalEvent = parseLine(buffer);
    if (finalEvent) {
      if (finalEvent.type === "done") finished = true;
      yield finalEvent;
    }
    if (!finished) throw new AIProviderError("provider_malformed_response");
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    if (abortContext.signal.aborted) {
      throw new AIProviderError(abortContext.timedOut() ? "provider_timeout" : "request_cancelled");
    }
    if (requestSignal.aborted) throw new AIProviderError("request_cancelled");
    throw new AIProviderError("provider_malformed_response");
  } finally {
    try {
      await reader.cancel();
    } catch {
      // The stream may already be closed or aborted.
    }
    reader.releaseLock();
  }
}

function parseLine(line) {
  if (!line.trim()) return null;
  let value;
  try {
    value = JSON.parse(line);
  } catch {
    throw new AIProviderError("provider_malformed_response");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AIProviderError("provider_malformed_response");
  }
  if (typeof value.error === "string") throw new AIProviderError("provider_error");
  if (value.done === true) return { type: "done" };
  if (value.message?.role !== "assistant" || typeof value.message?.content !== "string") {
    throw new AIProviderError("provider_malformed_response");
  }
  return value.message.content ? { type: "delta", text: value.message.content } : null;
}

function makeAbortContext(requestSignal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromRequest = () => controller.abort();
  if (requestSignal.aborted) controller.abort();
  else requestSignal.addEventListener("abort", abortFromRequest, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose() {
      clearTimeout(timer);
      requestSignal.removeEventListener("abort", abortFromRequest);
    },
  };
}

export function createOllamaAdapter(config, fetchImpl = fetch) {
  return {
    provider: "ollama",
    capabilities: OLLAMA_CAPABILITIES,
    async *stream(request) {
      if (!config.model) throw new AIProviderError("model_not_configured");
      if (!config.enabled) throw new AIProviderError("inference_disabled");

      const abortContext = makeAbortContext(request.signal, config.timeoutMs);
      const timeoutSignal = abortContext.signal;
      try {
        let tagsResponse;
        try {
          tagsResponse = await fetchImpl(`${config.baseUrl}/api/tags`, {
            method: "GET",
            cache: "no-store",
            signal: timeoutSignal,
          });
        } catch (error) {
          if (timeoutSignal.aborted) {
            throw new AIProviderError(abortContext.timedOut() ? "provider_timeout" : "request_cancelled");
          }
          throw classifyAbort(error, request.signal);
        }
        if (!tagsResponse.ok) throw new AIProviderError("provider_unavailable");

        let tags;
        try {
          tags = await tagsResponse.json();
        } catch (error) {
          if (timeoutSignal.aborted) {
            throw new AIProviderError(abortContext.timedOut() ? "provider_timeout" : "request_cancelled");
          }
          throw new AIProviderError("provider_malformed_response");
        }
        if (!Array.isArray(tags?.models) || tags.models.some((model) => !model || typeof model.name !== "string")) {
          throw new AIProviderError("provider_malformed_response");
        }
        if (!tags.models.some((model) => model.name === config.model)) {
          throw new AIProviderError("model_not_found");
        }

        let response;
        try {
          response = await fetchImpl(`${config.baseUrl}/api/chat`, {
            method: "POST",
            cache: "no-store",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              model: config.model,
              messages: request.messages,
              stream: true,
              options: { num_predict: Math.min(request.maxOutputTokens, config.maxOutputTokens) },
            }),
            signal: timeoutSignal,
          });
        } catch (error) {
          if (timeoutSignal.aborted) {
            throw new AIProviderError(abortContext.timedOut() ? "provider_timeout" : "request_cancelled");
          }
          throw classifyAbort(error, request.signal);
        }
        if (!response.ok) {
          throw new AIProviderError(response.status === 404 ? "model_not_found" : "provider_error");
        }
        yield* readChatStream(response.body, abortContext, request.signal);
      } finally {
        abortContext.dispose();
      }
    },
  };
}
