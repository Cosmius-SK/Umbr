import type { ModelConfiguration } from "./contracts.mjs";

export type AIAvailability =
  | "hosted_disabled"
  | "production_disabled"
  | "disabled"
  | "misconfigured"
  | "needs_model"
  | "local_enabled";

export type AIConfig = ModelConfiguration & { availability: AIAvailability };
export function readAIConfig(env?: Record<string, string | undefined>): AIConfig;
export function publicAvailability(config: AIConfig): {
  availability: AIAvailability;
  message: string;
};
