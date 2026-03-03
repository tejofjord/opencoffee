import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getEvent, requireOrganizer, requireUser } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";

interface EventDeleteBody {
  eventId?: string;
  mode?: "cancel" | "hard_delete";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const body = (await req.json()) as EventDeleteBody;
    if (!body.eventId) throw new Error("eventId is required");

    const admin = createAdminClient();
    const user = await requireUser(req, admin);
    const event = await getEvent(admin, body.eventId);
    await requireOrganizer(admin, event.chapter_id, user.id);

    const mode = body.mode ?? "cancel";
    if (mode !== "cancel" && mode !== "hard_delete") {
      throw new Error("mode must be cancel or hard_delete");
    }

    if (mode === "cancel") {
      const { error } = await admin
        .from("events")
        .update({ status: "cancelled" })
        .eq("id", body.eventId);
      if (error) throw new Error(error.message);

      await admin.from("audit_logs").insert({
        chapter_id: event.chapter_id,
        actor_id: user.id,
        action: "event_cancel",
        entity_type: "event",
        entity_id: body.eventId,
        payload: {},
      });

      return jsonResponse({ ok: true, mode }, 200, req);
    }

    const { error } = await admin.from("events").delete().eq("id", body.eventId);
    if (error) throw new Error(error.message);

    await admin.from("audit_logs").insert({
      chapter_id: event.chapter_id,
      actor_id: user.id,
      action: "event_delete",
      entity_type: "event",
      entity_id: body.eventId,
      payload: {},
    });

    return jsonResponse({ ok: true, mode }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400, req);
  }
});
