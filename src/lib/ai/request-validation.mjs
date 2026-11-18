export const MAX_REQUEST_BYTES = 256_000;
export const MAX_CONVERSATION_MESSAGES = 100;
export const MAX_CONVERSATION_MESSAGE_LENGTH = 2000;

export function validateConversationRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: "Send a JSON object containing a messages array." };
  }
  const { messages } = value;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, message: "A non-empty messages array is required." };
  }
  if (messages.length > MAX_CONVERSATION_MESSAGES) {
    return { ok: false, message: `A conversation can contain at most ${MAX_CONVERSATION_MESSAGES} messages.` };
  }

  for (const message of messages) {
    if (
      !message ||
      typeof message !== "object" ||
      Array.isArray(message) ||
      !["creator", "em"].includes(message.role) ||
      typeof message.text !== "string" ||
      message.text.trim().length === 0 ||
      message.text.length > MAX_CONVERSATION_MESSAGE_LENGTH
    ) {
      return {
        ok: false,
        message: `Each message must have role creator or em and contain 1–${MAX_CONVERSATION_MESSAGE_LENGTH} characters.`,
      };
    }
  }

  if (messages[messages.length - 1].role !== "creator") {
    return { ok: false, message: "The latest conversation message must be from the creator." };
  }

  return {
    ok: true,
    messages: messages.map(({ role, text }) => ({ role, text })),
  };
}
