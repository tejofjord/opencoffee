import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { assertConversationParticipant, assertNotBlocked, requireUser } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";

interface MessageSendBody {
  conversationId?: string;
  body?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const payload = (await req.json()) as MessageSendBody;
    if (!payload.conversationId) throw new Error("conversationId is required");
    if (!payload.body?.trim()) throw new Error("Message body is required");

    const admin = createAdminClient();
    const user = await requireUser(req, admin);
    const conversation = await assertConversationParticipant(admin, payload.conversationId, user.id);

    const otherUser = conversation.user_a_id === user.id ? conversation.user_b_id : conversation.user_a_id;
    await assertNotBlocked(admin, conversation.chapter_id, user.id, otherUser);

    const { data: message, error: messageError } = await admin
      .from("messages")
      .insert({
        conversation_id: payload.conversationId,
        sender_id: user.id,
        body: payload.body.trim(),
      })
      .select("id")
      .single();

    if (messageError || !message) throw new Error(messageError?.message || "Failed to send message");

    await admin.from("notification_jobs").insert({
      user_id: otherUser,
      kind: "message_digest",
      payload: {
        conversationId: payload.conversationId,
        messageId: message.id,
      },
      dedupe_key: `${payload.conversationId}:${message.id}`,
      run_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      status: "pending",
    });

    return jsonResponse({ messageId: message.id }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400, req);
  }
});
