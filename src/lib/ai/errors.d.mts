import type { ProviderErrorCode, PublicError } from "./contracts.mjs";

export class AIProviderError extends Error {
  code: ProviderErrorCode;
  constructor(code: ProviderErrorCode);
}
export function publicError(error: unknown): PublicError;
