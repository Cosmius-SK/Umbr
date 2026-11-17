import assert from "node:assert/strict";
import test from "node:test";
import { handleConversationRequest } from "./handler.mjs";

const enabledEnv = {
  NODE_ENV: "development",
  AI_PROVIDER: "ollama",
  EM_AI_ENABLED: "true",
  OLLAMA_MODEL: "local-model:8b",
};

function post(body, headers = { "content-type": "application/json" }) {
  return new Request("http://localhost/api/conversation", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("disabled inference returns an honest message without calling Ollama", async () => {
  let calls = 0;
  const response = await handleConversationRequest(post({ messages: [{ role: "creator", text: "Hello" }] }), {
    env: { NODE_ENV: "development" },
    fetchImpl: async () => { calls += 1; },
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error.message, /disabled/i);
  assert.equal(calls, 0);
});

test("enabled inference without a configured model remains offline", async () => {
  let calls = 0;
  const response = await handleConversationRequest(post({ messages: [{ role: "creator", text: "Hello" }] }), {
    env: { ...enabledEnv, OLLAMA_MODEL: "" },
    fetchImpl: async () => { calls += 1; },
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error.message, /already-installed model/i);
  assert.equal(calls, 0);
});

test("Vercel production stays inference-disabled even with local config enabled", async () => {
  let calls = 0;
  const response = await handleConversationRequest(post({ messages: [{ role: "creator", text: "Hello" }] }), {
    env: { ...enabledEnv, NODE_ENV: "production", VERCEL: "1" },
    fetchImpl: async () => { calls += 1; },
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error.message, /hosted inference is disabled/i);
  assert.equal(calls, 0);
});

test("invalid requests and oversized bodies are rejected before inference", async () => {
  const invalid = await handleConversationRequest(post({ messages: [{ role: "system", text: "bad" }] }), {
    env: enabledEnv,
    fetchImpl: async () => { assert.fail("Provider must not be called for invalid requests"); },
  });
  assert.equal(invalid.status, 400);

  const tooLarge = await handleConversationRequest(post("x".repeat(256_001)), { env: enabledEnv });
  assert.equal(tooLarge.status, 413);

  const wrongType = await handleConversationRequest(post("{}", { "content-type": "text/plain" }), { env: enabledEnv });
  assert.equal(wrongType.status, 415);
});

test("status endpoint differentiates local setup from hosted-disabled mode without leaking configuration", async () => {
  const local = await handleConversationRequest(new Request("http://localhost/api/conversation"), { env: enabledEnv });
  const status = await local.json();
  assert.equal(status.availability, "local_enabled");
  assert.equal(JSON.stringify(status).includes("local-model"), false);
  assert.equal(JSON.stringify(status).includes("127.0.0.1"), false);

  const hosted = await handleConversationRequest(new Request("http://localhost/api/conversation"), {
    env: { ...enabledEnv, VERCEL: "1", NODE_ENV: "production" },
  });
  assert.equal((await hosted.json()).availability, "hosted_disabled");
});

test("streaming API forwards only deltas and done events while hiding provider internals", async () => {
  const encoder = new TextEncoder();
  const response = await handleConversationRequest(post({ messages: [{ role: "creator", text: "Hi" }] }), {
    env: enabledEnv,
    fetchImpl: async (url, options) => {
      if (url.endsWith("/api/tags")) return Response.json({ models: [{ name: enabledEnv.OLLAMA_MODEL }] });
      const body = JSON.parse(options.body);
      assert.equal(body.messages[0].role, "system");
      assert.equal(body.messages.at(-1).role, "user");
      assert.equal(body.stream, true);
      const chunk = encoder.encode('{"message":{"role":"assistant","content":"Hello"},"done":false}\n{"done":true}\n');
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(chunk); controller.close(); } }));
    },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/x-ndjson/);
  const events = (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(events, [{ type: "delta", text: "Hello" }, { type: "done" }]);
});

test("upstream details never reach browser error events", async () => {
  const response = await handleConversationRequest(post({ messages: [{ role: "creator", text: "Hi" }] }), {
    env: enabledEnv,
    fetchImpl: async () => { throw new TypeError("failed connecting to http://127.0.0.1:11434 private-secret"); },
  });
  const text = await response.text();
  assert.match(text, /local AI service could not be reached/i);
  assert.equal(text.includes("127.0.0.1"), false);
  assert.equal(text.includes("private-secret"), false);
});
