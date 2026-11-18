export const MAX_REQUEST_BYTES: number;
export const MAX_CONVERSATION_MESSAGES: number;
export const MAX_CONVERSATION_MESSAGE_LENGTH: number;

export type ConversationMessage = { role: "creator" | "em"; text: string };
export function validateConversationRequest(value: unknown):
  | { ok: true; messages: ConversationMessage[] }
  | { ok: false; message: string };
