import assert from "node:assert/strict";
import test from "node:test";
import { ConversationStreamError, readConversationStream } from "./stream-reader.mjs";

async function collect(stream) {
  const events = [];
  for await (const event of readConversationStream(stream)) events.push(event);
  return events;
}

test("client parser reconstructs chunked NDJSON events", async () => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode('{"type":"delta","text":"Hi 🌍"}\n{"type":"done"}\n');
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.slice(0, 19));
      controller.enqueue(bytes.slice(19, 24));
      controller.enqueue(bytes.slice(24));
      controller.close();
    },
  });
  assert.deepEqual(await collect(stream), [
    { type: "delta", text: "Hi 🌍" },
    { type: "done" },
  ]);
});

test("client parser presents only sanitized stream errors", async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", error: { code: "provider_unavailable", message: "Local inference is unavailable." } })}\n`));
      controller.close();
    },
  });
  await assert.rejects(collect(body), ConversationStreamError);
});
