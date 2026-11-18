import type { Message } from "../conversation-session.mjs";

export function removeIncompleteResponse(
  messages: Message[],
  responseId: string,
): { messages: Message[]; hadPartialText: boolean };
export function incompleteResponseStatus(options: {
  cancelled: boolean;
  hadPartialText: boolean;
  errorMessage: string;
}): string;
