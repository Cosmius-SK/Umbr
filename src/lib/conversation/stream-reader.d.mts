import type { GenerationEvent } from "../ai/contracts.mjs";

export class ConversationStreamError extends Error {}
export function readConversationStream(body: ReadableStream<Uint8Array> | null): AsyncIterable<GenerationEvent>;
