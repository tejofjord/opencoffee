import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { assertNotBlocked, requireUser } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";

interface ConnectRespondBody {
  requestId?: string;
  decision?: "accept" | "decline";
}

function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const body = (await req.json()) as ConnectRespondBody;
    if (!body.requestId) throw new Error("requestId is required");
    if (!body.decision) throw new Error("decision is required");

    const admin = createAdminClient();
    const user = await requireUser(req, admin);

    const { data: request, error: requestError } = await admin
      .from("connection_requests")
      .select("id, chapter_id, requester_id, target_user_id, status")
      .eq("id", body.requestId)
      .single();

    if (requestError || !request) throw new Error("Request not found");
    if (request.target_user_id !== user.id) throw new Error("Only target user can respond");
    if (request.status !== "pending") throw new Error("Request is no longer pending");

    const status = body.decision === "accept" ? "accepted" : "declined";
    const { error: updateError } = await admin
      .from("connection_requests")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", body.requestId);

    if (updateError) throw new Error(updateError.message);

    let conversationId: string | null = null;

    if (body.decision === "accept") {
      await assertNotBlocked(admin, request.chapter_id, request.requester_id, request.target_user_id);

      const [userA, userB] = sortPair(request.requester_id, request.target_user_id);

      const existing = await admin
        .from("conversations")
        .select("id")
        .eq("chapter_id", request.chapter_id)
        .eq("user_a_id", userA)
        .eq("user_b_id", userB)
        .maybeSingle();

      if (existing.data?.id) {
        conversationId = existing.data.id;
      } else {
        const created = await admin
          .from("conversations")
          .insert({
            chapter_id: request.chapter_id,
            user_a_id: userA,
            user_b_id: userB,
            created_from_request_id: request.id,
          })
          .select("id")
          .single();

        if (created.error || !created.data) {
          throw new Error(created.error?.message || "Failed to create conversation");
        }

        conversationId = created.data.id;
      }
    }

    return jsonResponse({ ok: true, conversationId }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400, req);
  }
});
