import type { GenerationEvent, ModelAdapter, ModelMessage } from "../ai/contracts.mjs";

export function buildModelMessages(
  messages: Array<{ role: "creator" | "em"; text: string }>,
): ModelMessage[];
export function streamConversation(
  messages: Array<{ role: "creator" | "em"; text: string }>,
  adapter: ModelAdapter,
  signal: AbortSignal,
): AsyncIterable<GenerationEvent>;
