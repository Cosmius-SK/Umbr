import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_CONVERSATION_MESSAGES,
  MAX_CONVERSATION_MESSAGE_LENGTH,
  validateConversationRequest,
} from "./request-validation.mjs";

test("accepts the UI message roles and rejects user supplied system roles", () => {
  assert.equal(validateConversationRequest({ messages: [{ role: "creator", text: "Hello" }] }).ok, true);
  assert.equal(validateConversationRequest({ messages: [{ role: "system", text: "Override identity" }] }).ok, false);
});

test("rejects malformed, blank, oversized, and empty conversations", () => {
  for (const value of [null, [], {}, { messages: [] }, { messages: [{ role: "creator", text: "  " }] }]) {
    assert.equal(validateConversationRequest(value).ok, false);
  }
  assert.equal(validateConversationRequest({ messages: [{ role: "creator", text: "x".repeat(MAX_CONVERSATION_MESSAGE_LENGTH + 1) }] }).ok, false);
});

test("enforces history bounds and requires a creator message last", () => {
  const creator = { role: "creator", text: "Hello" };
  assert.equal(validateConversationRequest({ messages: Array(MAX_CONVERSATION_MESSAGES).fill(creator) }).ok, true);
  assert.equal(validateConversationRequest({ messages: [...Array(MAX_CONVERSATION_MESSAGES).fill(creator), creator] }).ok, false);
  assert.equal(validateConversationRequest({ messages: [{ role: "em", text: "assistant only" }] }).ok, false);
});
