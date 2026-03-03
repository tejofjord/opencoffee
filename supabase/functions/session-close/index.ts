import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireOrganizer, requireUser, getEvent } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";

interface SessionCloseBody {
  eventId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const body = (await req.json()) as SessionCloseBody;
    if (!body.eventId) throw new Error("eventId is required");

    const admin = createAdminClient();
    const user = await requireUser(req, admin);
    const event = await getEvent(admin, body.eventId);
    await requireOrganizer(admin, event.chapter_id, user.id);

    const { data, error } = await admin
      .from("event_sessions")
      .update({
        status: "closed",
        timer_started_at: null,
        timer_elapsed_seconds: 0,
        updated_by: user.id,
      })
      .eq("event_id", body.eventId)
      .select(
        "id, event_id, status, opens_at, closes_at, chunk_size, current_chunk_start, active_signup_id, timer_started_at, timer_elapsed_seconds",
      )
      .single();

    if (error || !data) throw new Error(error?.message || "Session not found");

    await admin.from("audit_logs").insert({
      chapter_id: event.chapter_id,
      actor_id: user.id,
      action: "session_close",
      entity_type: "event",
      entity_id: body.eventId,
      payload: {
        closesAt: data.closes_at,
      },
    });

    return jsonResponse({
      session: {
        id: data.id,
        eventId: data.event_id,
        status: data.status,
        opensAt: data.opens_at,
        closesAt: data.closes_at,
        chunkSize: data.chunk_size,
        currentChunkStart: data.current_chunk_start,
        activeSignupId: data.active_signup_id,
        timerStartedAt: data.timer_started_at,
        timerElapsedSeconds: data.timer_elapsed_seconds,
      },
    }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400, req);
  }
});
