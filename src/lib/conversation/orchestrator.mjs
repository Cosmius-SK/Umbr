import { EM_IDENTITY_INSTRUCTIONS } from "../em/identity.mjs";

export function buildModelMessages(messages) {
  return [
    { role: "system", content: EM_IDENTITY_INSTRUCTIONS },
    ...messages.map((message) => ({
      role: message.role === "creator" ? "user" : "assistant",
      content: message.text,
    })),
  ];
}

export async function* streamConversation(messages, adapter, signal) {
  yield* adapter.stream({
    messages: buildModelMessages(messages),
    maxOutputTokens: adapter.capabilities.maxOutputTokens,
    signal,
  });
}
