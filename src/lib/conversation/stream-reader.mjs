export class ConversationStreamError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConversationStreamError";
  }
}

export async function* readConversationStream(body) {
  if (!body) throw new ConversationStreamError("The conversation service returned no response stream.");
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
        const event = parseEvent(line);
        if (!event) continue;
        if (event.type === "error") throw new ConversationStreamError(event.error.message);
        if (event.type === "done") finished = true;
        yield event;
      }
      if (done) break;
    }

    const finalEvent = parseEvent(buffer);
    if (finalEvent) {
      if (finalEvent.type === "error") throw new ConversationStreamError(finalEvent.error.message);
      if (finalEvent.type === "done") finished = true;
      yield finalEvent;
    }
    if (!finished) throw new ConversationStreamError("The conversation stream ended unexpectedly.");
  } finally {
    try {
      await reader.cancel();
    } catch {
      // The response may already be closed or aborted.
    }
    reader.releaseLock();
  }
}

function parseEvent(line) {
  if (!line.trim()) return null;
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    throw new ConversationStreamError("The conversation service returned an unreadable response.");
  }
  if (event?.type === "delta" && typeof event.text === "string") return event;
  if (event?.type === "done") return event;
  if (event?.type === "error" && typeof event.error?.message === "string") return event;
  throw new ConversationStreamError("The conversation service returned an unreadable response.");
}
