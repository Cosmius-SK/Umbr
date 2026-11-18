import {
  getConversationAvailability,
  postConversationRequest,
} from "@/lib/ai/handler.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return getConversationAvailability();
}

export async function POST(request: Request) {
  return postConversationRequest(request);
}
