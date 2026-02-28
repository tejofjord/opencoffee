import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getEvent, requireOrganizer, requireUser } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";

interface QueueReorderBody {
  eventId?: string;
  orderedSignupIds?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as QueueReorderBody;
    if (!body.eventId) throw new Error("eventId is required");
    if (!Array.isArray(body.orderedSignupIds) || body.orderedSignupIds.length === 0) {
      throw new Error("orderedSignupIds is required");
    }

    const admin = createAdminClient();
    const user = await requireUser(req, admin);
    const event = await getEvent(admin, body.eventId);
    await requireOrganizer(admin, event.chapter_id, user.id);

    for (const [index, signupId] of body.orderedSignupIds.entries()) {
      const { error } = await admin
        .from("event_signups")
        .update({ queue_position: index + 1 })
        .eq("id", signupId)
        .eq("event_id", body.eventId);

      if (error) throw new Error(error.message);
    }

    await admin
      .from("audit_logs")
      .insert({
        chapter_id: event.chapter_id,
        actor_id: user.id,
        action: "queue_reorder",
        entity_type: "event",
        entity_id: body.eventId,
        payload: { count: body.orderedSignupIds.length },
      });

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400);
  }
});
