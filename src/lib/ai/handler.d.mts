export function getConversationAvailability(
  options?: { env?: Record<string, string | undefined> },
): Promise<Response>;
export function postConversationRequest(
  request: Request,
  options?: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch },
): Promise<Response>;
