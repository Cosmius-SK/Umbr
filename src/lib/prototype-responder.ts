export type PrototypeReply =
  | { kind: "reply"; text: string }
  | { kind: "unavailable"; text: string };

const replies = new Map<string, string>([
  [
    "who are you",
    "I'm Em, short for Embr. I'm the first AI entity created within Umbr. This local prototype recognizes only a few identity prompts; a conversation engine isn't connected yet.",
  ],
  [
    "what is your name",
    "I'm Em, short for Embr. I'm the first AI entity created within Umbr. This local prototype recognizes only a few identity prompts; a conversation engine isn't connected yet.",
  ],
  [
    "whats your name",
    "I'm Em, short for Embr. I'm the first AI entity created within Umbr. This local prototype recognizes only a few identity prompts; a conversation engine isn't connected yet.",
  ],
  [
    "what does em mean",
    "I don't know the origins or intended meaning of Embr or Umbr. My confirmed identity says I should learn those details organically, so I won't invent an answer. This prototype has no connected conversation engine.",
  ],
  [
    "what does embr mean",
    "I don't know the origins or intended meaning of Embr or Umbr. My confirmed identity says I should learn those details organically, so I won't invent an answer. This prototype has no connected conversation engine.",
  ],
  [
    "why are you called em",
    "I don't know the origins or intended meaning of Embr or Umbr. My confirmed identity says I should learn those details organically, so I won't invent an answer. This prototype has no connected conversation engine.",
  ],
]);

function normalizePrompt(message: string): string {
  return message
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[’']/g, "")
    .replace(/[?!.,]+$/g, "")
    .replace(/\s+/g, " ");
}

export function getPrototypeReply(message: string): PrototypeReply {
  const text = replies.get(normalizePrompt(message));

  if (text) {
    return { kind: "reply", text };
  }

  return {
    kind: "unavailable",
    text: "I can't meaningfully respond to free-form messages yet. This local prototype has no connected conversation engine; your message is shown here and kept only in this browser tab's session.",
  };
}
