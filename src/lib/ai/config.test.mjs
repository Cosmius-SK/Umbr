import assert from "node:assert/strict";
import test from "node:test";
import { readAIConfig, publicAvailability } from "./config.mjs";

const enabled = {
  NODE_ENV: "development",
  AI_PROVIDER: "ollama",
  EM_AI_ENABLED: "true",
  OLLAMA_MODEL: "qwen3:8b",
};

test("inference is disabled by default and points only to the local loopback", () => {
  const config = readAIConfig({ NODE_ENV: "development" });
  assert.equal(config.enabled, false);
  assert.equal(config.baseUrl, "http://127.0.0.1:11434");
  assert.equal(config.availability, "disabled");
});

test("local development can enable an already configured Ollama model", () => {
  const config = readAIConfig(enabled);
  assert.equal(config.enabled, true);
  assert.equal(config.provider, "ollama");
  assert.equal(config.model, "qwen3:8b");
  assert.equal(config.maxOutputTokens, 512);
});

test("production and Vercel always disable inference", () => {
  assert.equal(readAIConfig({ ...enabled, NODE_ENV: "production" }).availability, "production_disabled");
  assert.equal(readAIConfig({ ...enabled, VERCEL: "1" }).availability, "hosted_disabled");
});

test("remote endpoints and hosted Ollama model names are rejected", () => {
  assert.equal(readAIConfig({ ...enabled, OLLAMA_BASE_URL: "https://inference.example" }).availability, "misconfigured");
  assert.equal(readAIConfig({ ...enabled, OLLAMA_MODEL: "qwen3:cloud" }).availability, "misconfigured");
  assert.equal(readAIConfig({ ...enabled, AI_PROVIDER: "openai" }).availability, "misconfigured");
});

test("loopback endpoints are returned only in canonical form", () => {
  assert.equal(readAIConfig({ ...enabled, OLLAMA_BASE_URL: "HTTP://LOCALHOST:11434/" }).baseUrl, "http://localhost:11434");
  assert.equal(readAIConfig({ ...enabled, OLLAMA_BASE_URL: "http://[::1]:11434" }).baseUrl, "http://[::1]:11434");
});

test("invalid Ollama URLs fail closed and never survive in configuration", () => {
  const invalidUrls = [
    "https://127.0.0.1:11434",
    "ftp://127.0.0.1:11434",
    "file:///127.0.0.1:11434",
    "http://example.com:11434",
    "http://localhost.evil:11434",
    "http://user:pass@127.0.0.1:11434",
    "http://@127.0.0.1:11434",
    "http://127.0.0.1:11434/api",
    "http://127.0.0.1:11434/../api",
    "http://127.0.0.1:11434?mode=local",
    "http://127.0.0.1:11434?",
    "http://127.0.0.1:11434#fragment",
    "http://127.0.0.1:11434#",
    "not a URL",
    "http:\\\\127.0.0.1:11434",
  ];

  for (const OLLAMA_BASE_URL of invalidUrls) {
    const config = readAIConfig({ ...enabled, OLLAMA_BASE_URL });
    assert.equal(config.availability, "misconfigured", OLLAMA_BASE_URL);
    assert.equal(config.enabled, false, OLLAMA_BASE_URL);
    assert.equal(config.baseUrl, "http://127.0.0.1:11434", OLLAMA_BASE_URL);
    assert.equal(config.baseUrl.includes(OLLAMA_BASE_URL), false, OLLAMA_BASE_URL);
  }
});

test("an invalid URL is misconfigured even when inference is otherwise disabled", () => {
  const config = readAIConfig({
    NODE_ENV: "development",
    EM_AI_ENABLED: "false",
    OLLAMA_BASE_URL: "https://127.0.0.1:11434",
  });
  assert.equal(config.availability, "misconfigured");
  assert.equal(config.baseUrl, "http://127.0.0.1:11434");
});

test("missing model and invalid timeout use safe local-only configuration", () => {
  const config = readAIConfig({ ...enabled, OLLAMA_MODEL: "", OLLAMA_TIMEOUT_MS: "not-a-number" });
  assert.equal(config.availability, "needs_model");
  assert.equal(config.timeoutMs, 60_000);
});

test("public status does not reveal configured endpoint or model", () => {
  const status = publicAvailability(readAIConfig({ ...enabled, OLLAMA_BASE_URL: "http://localhost:11434", OLLAMA_MODEL: "private-model" }));
  const text = JSON.stringify(status);
  assert.equal(text.includes("localhost"), false);
  assert.equal(text.includes("private-model"), false);
});
