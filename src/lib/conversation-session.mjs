export const STORAGE_KEY = "umbr:em:conversation:v1";
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_HISTORY_LENGTH = 100;

export function isMessageList(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_HISTORY_LENGTH &&
    value.every(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        typeof message.id === "string" &&
        (message.role === "em" || message.role === "creator") &&
        typeof message.text === "string" &&
        message.text.length <= MAX_MESSAGE_LENGTH * 2,
    )
  );
}

export function loadConversationSession(getStorage, fallbackMessages) {
  let saved;
  try {
    saved = getStorage().getItem(STORAGE_KEY);
  } catch {
    return { status: "ready", messages: fallbackMessages, storageAvailable: false };
  }

  if (saved !== null) {
    try {
      const parsed = JSON.parse(saved);
      if (isMessageList(parsed)) {
        return { status: "ready", messages: parsed, storageAvailable: true };
      }
    } catch {
      // Invalid saved data falls back to the welcome state.
    }
  }
  return { status: "ready", messages: fallbackMessages, storageAvailable: true };
}

export function saveConversationSession(getStorage, state) {
  if (state.status !== "ready") return;
  try {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(state.messages));
    return true;
  } catch {
    return false;
  }
}
