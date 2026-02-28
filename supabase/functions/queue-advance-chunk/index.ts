import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getEvent, requireOrganizer, requireUser } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";

interface QueueAdvanceChunkBody {
  eventId?: string;
  direction?: "next" | "prev";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as QueueAdvanceChunkBody;
    if (!body.eventId) throw new Error("eventId is required");

    const admin = createAdminClient();
    const user = await requireUser(req, admin);
    const event = await getEvent(admin, body.eventId);
    await requireOrganizer(admin, event.chapter_id, user.id);

    const { data: session, error: sessionError } = await admin
      .from("event_sessions")
      .select(
        "id, event_id, status, opens_at, closes_at, chunk_size, current_chunk_start, active_signup_id, timer_started_at, timer_elapsed_seconds",
      )
      .eq("event_id", body.eventId)
      .single();

    if (sessionError || !session) throw new Error("Session not found");

    const { count, error: countError } = await admin
      .from("event_signups")
      .select("id", { count: "exact", head: true })
      .eq("event_id", body.eventId);

    if (countError) throw new Error(countError.message);

    const chunkSize = session.chunk_size;
    const step = body.direction === "prev" ? -chunkSize : chunkSize;
    const maxStart = Math.max(0, Math.floor(Math.max((count ?? 0) - 1, 0) / chunkSize) * chunkSize);
    const nextStart = Math.max(0, Math.min(maxStart, session.current_chunk_start + step));

    const { data: updated, error: updateError } = await admin
      .from("event_sessions")
      .update({ current_chunk_start: nextStart, updated_by: user.id })
      .eq("id", session.id)
      .select(
        "id, event_id, status, opens_at, closes_at, chunk_size, current_chunk_start, active_signup_id, timer_started_at, timer_elapsed_seconds",
      )
      .single();

    if (updateError || !updated) throw new Error(updateError?.message || "Failed to update chunk");

    return jsonResponse({
      session: {
        id: updated.id,
        eventId: updated.event_id,
        status: updated.status,
        opensAt: updated.opens_at,
        closesAt: updated.closes_at,
        chunkSize: updated.chunk_size,
        currentChunkStart: updated.current_chunk_start,
        activeSignupId: updated.active_signup_id,
        timerStartedAt: updated.timer_started_at,
        timerElapsedSeconds: updated.timer_elapsed_seconds,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400);
  }
});
