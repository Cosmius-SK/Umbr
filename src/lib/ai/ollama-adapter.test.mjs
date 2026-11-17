import assert from "node:assert/strict";
import test from "node:test";
import { createOllamaAdapter } from "./ollama-adapter.mjs";
import { AIProviderError, publicError } from "./errors.mjs";

const config = {
  provider: "ollama",
  enabled: true,
  baseUrl: "http://127.0.0.1:11434",
  model: "qwen3:8b",
  timeoutMs: 60_000,
  maxOutputTokens: 512,
};
const encoder = new TextEncoder();

function tagsResponse(names = [config.model]) {
  return Response.json({ models: names.map((name) => ({ name })) });
}

function streamResponse(lines) {
  const chunks = lines.map((line) => encoder.encode(`${JSON.stringify(line)}\n`));
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        const split = Math.max(1, Math.floor(chunk.length / 2));
        controller.enqueue(chunk.slice(0, split));
        controller.enqueue(chunk.slice(split));
      }
      controller.close();
    },
  }));
}

async function collect(iterable) {
  const events = [];
  for await (const event of iterable) events.push(event);
  return events;
}

async function getError(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail("Expected the provider operation to fail");
}

test("maps model, messages, stream mode, and output token limit to Ollama chat", async () => {
  const calls = [];
  const adapter = createOllamaAdapter(config, async (url, options) => {
    calls.push({ url, options });
    return url.endsWith("/api/tags")
      ? tagsResponse()
      : streamResponse([
          { message: { role: "assistant", content: "Hello " }, done: false },
          { message: { role: "assistant", content: "Em 🌱" }, done: false },
          { done: true },
        ]);
  });
  const events = await collect(adapter.stream({
    messages: [{ role: "user", content: "Hello" }],
    maxOutputTokens: 900,
    signal: new AbortController().signal,
  }));

  assert.equal(calls[0].url, `${config.baseUrl}/api/tags`);
  assert.equal(calls[1].url, `${config.baseUrl}/api/chat`);
  const mapped = JSON.parse(calls[1].options.body);
  assert.equal(mapped.model, config.model);
  assert.equal(mapped.stream, true);
  assert.equal(mapped.options.num_predict, 512);
  assert.deepEqual(events, [
    { type: "delta", text: "Hello " },
    { type: "delta", text: "Em 🌱" },
    { type: "done" },
  ]);
});

test("missing model configuration makes no provider request", async () => {
  let calls = 0;
  const adapter = createOllamaAdapter({ ...config, model: "" }, async () => { calls += 1; });
  const error = await getError(collect(adapter.stream({ messages: [], maxOutputTokens: 2, signal: new AbortController().signal })));
  assert.equal(error.code, "model_not_configured");
  assert.equal(calls, 0);
});

test("an uninstalled model is reported without sending a generation request", async () => {
  let calls = 0;
  const adapter = createOllamaAdapter(config, async () => {
    calls += 1;
    return tagsResponse(["another-model"]);
  });
  const error = await getError(collect(adapter.stream({ messages: [], maxOutputTokens: 2, signal: new AbortController().signal })));
  assert.equal(error.code, "model_not_found");
  assert.equal(calls, 1);
});

test("unavailable services and malformed responses produce normalized errors", async () => {
  const unavailable = createOllamaAdapter(config, async () => { throw new TypeError(`failed ${config.baseUrl}`); });
  const unavailableError = await getError(collect(unavailable.stream({ messages: [], maxOutputTokens: 2, signal: new AbortController().signal })));
  assert.equal(unavailableError.code, "provider_unavailable");
  assert.equal(publicError(unavailableError).message.includes(config.baseUrl), false);

  const malformed = createOllamaAdapter(config, async (url) =>
    url.endsWith("/api/tags") ? tagsResponse() : new Response("not-json"),
  );
  const malformedError = await getError(collect(malformed.stream({ messages: [], maxOutputTokens: 2, signal: new AbortController().signal })));
  assert.equal(malformedError.code, "provider_malformed_response");
});

test("provider errors in a stream are normalized and do not expose upstream text", async () => {
  const adapter = createOllamaAdapter(config, async (url) =>
    url.endsWith("/api/tags")
      ? tagsResponse()
      : streamResponse([{ error: `upstream secret at ${config.baseUrl}` }]),
  );
  const error = await getError(collect(adapter.stream({ messages: [], maxOutputTokens: 2, signal: new AbortController().signal })));
  assert.equal(error.code, "provider_error");
  assert.equal(publicError(error).message.includes(config.baseUrl), false);
});

test("timeout and caller cancellation abort provider requests distinctly", async () => {
  const waitForAbort = (signal) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
  });
  const timed = createOllamaAdapter({ ...config, timeoutMs: 15 }, async (url, options) =>
    url.endsWith("/api/tags") ? tagsResponse() : waitForAbort(options.signal),
  );
  const timeoutError = await getError(collect(timed.stream({ messages: [], maxOutputTokens: 2, signal: new AbortController().signal })));
  assert.equal(timeoutError.code, "provider_timeout");

  const controller = new AbortController();
  let postStarted;
  const started = new Promise((resolve) => { postStarted = resolve; });
  const cancellable = createOllamaAdapter(config, async (url, options) => {
    if (url.endsWith("/api/tags")) return tagsResponse();
    postStarted();
    return waitForAbort(options.signal);
  });
  const pending = collect(cancellable.stream({ messages: [], maxOutputTokens: 2, signal: controller.signal }));
  await started;
  controller.abort();
  const cancelError = await getError(pending);
  assert.equal(cancelError.code, "request_cancelled");
});
