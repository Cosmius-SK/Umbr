export function handleConversationRequest(
  request: Request,
  options?: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch },
): Promise<Response>;
