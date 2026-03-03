import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getEvent, requireOrganizer, requireUser } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";

interface QueueReorderBody {
  eventId?: string;
  orderedSignupIds?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
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

    const { error: reorderError } = await admin.rpc("reorder_event_queue", {
      p_event_id: body.eventId,
      p_ordered_signup_ids: body.orderedSignupIds,
      p_actor_id: user.id,
    });
    if (reorderError) throw new Error(reorderError.message);

    return jsonResponse({ ok: true }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400, req);
  }
});
