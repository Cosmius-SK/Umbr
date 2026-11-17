export type Message = {
  id: string;
  role: "em" | "creator";
  text: string;
};

export type ConversationState = {
  status: "loading" | "ready";
  messages: Message[];
};

export const STORAGE_KEY: string;
export const MAX_MESSAGE_LENGTH: number;
export const MAX_HISTORY_LENGTH: number;
export function isMessageList(value: unknown): value is Message[];
export function loadConversationSession(
  getStorage: () => Storage,
  fallbackMessages: Message[],
): ConversationState & { storageAvailable: boolean };
export function saveConversationSession(
  getStorage: () => Storage,
  state: ConversationState,
): boolean | undefined;
