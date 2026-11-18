import type { ModelAdapter, ModelConfiguration } from "./contracts.mjs";

export const OLLAMA_CAPABILITIES: Readonly<ModelAdapter["capabilities"]>;
export function createOllamaAdapter(
  config: ModelConfiguration,
  fetchImpl?: typeof fetch,
): ModelAdapter;
