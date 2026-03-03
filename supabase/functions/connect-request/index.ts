import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
  assertNotBlocked,
  requireChapterMember,
  requireUser,
} from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";

interface ConnectRequestBody {
  chapterId?: string;
  eventId?: string | null;
  targetUserId?: string;
  type?: "need_help" | "can_help";
  message?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const body = (await req.json()) as ConnectRequestBody;

    if (!body.chapterId) throw new Error("chapterId is required");
    if (!body.targetUserId) throw new Error("targetUserId is required");
    if (body.type !== "need_help" && body.type !== "can_help") {
      throw new Error("type must be need_help or can_help");
    }

    const admin = createAdminClient();
    const user = await requireUser(req, admin);
    if (body.targetUserId === user.id) throw new Error("Cannot request yourself");

    await requireChapterMember(admin, body.chapterId, user.id);
    await requireChapterMember(admin, body.chapterId, body.targetUserId);
    await assertNotBlocked(admin, body.chapterId, user.id, body.targetUserId);

    const { data, error } = await admin
      .from("connection_requests")
      .insert({
        chapter_id: body.chapterId,
        event_id: body.eventId,
        requester_id: user.id,
        target_user_id: body.targetUserId,
        request_type: body.type,
        message: body.message?.trim() || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message || "Failed to create request");

    return jsonResponse({ requestId: data.id }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400, req);
  }
});
