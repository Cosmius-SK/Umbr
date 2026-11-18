export type ConversationRole = "system" | "user" | "assistant";

export type ModelMessage = {
  role: ConversationRole;
  content: string;
};

export type GenerationRequest = {
  messages: ModelMessage[];
  maxOutputTokens: number;
  signal: AbortSignal;
};

export type GenerationEvent =
  | { type: "delta"; text: string }
  | { type: "done" };

export type ModelConfiguration = {
  provider: string;
  enabled: boolean;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
};

export type ModelCapabilities = {
  streaming: boolean;
  cancellation: boolean;
  localOnly: boolean;
  maxOutputTokens: number;
};

export interface ModelAdapter {
  readonly provider: string;
  readonly capabilities: ModelCapabilities;
  stream(request: GenerationRequest): AsyncIterable<GenerationEvent>;
}

export type ProviderErrorCode =
  | "configuration_invalid"
  | "inference_disabled"
  | "model_not_configured"
  | "model_not_found"
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_malformed_response"
  | "provider_error"
  | "request_cancelled";

export type PublicError = {
  code: ProviderErrorCode | "invalid_request" | "payload_too_large";
  message: string;
};
