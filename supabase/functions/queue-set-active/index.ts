import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getEvent, requireOrganizer, requireUser } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";

interface QueueSetActiveBody {
  eventId?: string;
  signupId?: string;
  timerAction?: "start" | "pause" | "reset" | "next";
}

function secondsSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const body = (await req.json()) as QueueSetActiveBody;
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

    const updatePayload: Record<string, unknown> = {
      updated_by: user.id,
    };

    if (body.signupId) {
      const { data: signup, error: signupError } = await admin
        .from("event_signups")
        .select("id")
        .eq("event_id", body.eventId)
        .eq("id", body.signupId)
        .single();
      if (signupError || !signup) throw new Error("Signup not found in event queue");
      updatePayload.active_signup_id = body.signupId;
      updatePayload.timer_started_at = null;
      updatePayload.timer_elapsed_seconds = 0;
    }

    if (body.timerAction === "start") {
      if (!session.timer_started_at) updatePayload.timer_started_at = new Date().toISOString();
    }

    if (body.timerAction === "pause") {
      if (session.timer_started_at) {
        updatePayload.timer_elapsed_seconds = session.timer_elapsed_seconds + secondsSince(session.timer_started_at);
        updatePayload.timer_started_at = null;
      }
    }

    if (body.timerAction === "reset") {
      updatePayload.timer_elapsed_seconds = 0;
      updatePayload.timer_started_at = null;
    }

    if (body.timerAction === "next") {
      if (session.active_signup_id) {
        await admin
          .from("event_signups")
          .update({ status: "presented", presented_at: new Date().toISOString() })
          .eq("id", session.active_signup_id)
          .eq("event_id", body.eventId);
      }

      const { data: current } = session.active_signup_id
        ? await admin
            .from("event_signups")
            .select("queue_position")
            .eq("id", session.active_signup_id)
            .maybeSingle()
        : { data: null };

      let nextSignupId: string | null = null;

      const nextQuery = await admin
        .from("event_signups")
        .select("id")
        .eq("event_id", body.eventId)
        .gt("queue_position", current?.queue_position ?? 0)
        .order("queue_position", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextQuery.data?.id) {
        nextSignupId = nextQuery.data.id;
      } else {
        const fallback = await admin
          .from("event_signups")
          .select("id")
          .eq("event_id", body.eventId)
          .order("queue_position", { ascending: true })
          .limit(1)
          .maybeSingle();
        nextSignupId = fallback.data?.id ?? null;
      }

      updatePayload.active_signup_id = nextSignupId;
      updatePayload.timer_started_at = null;
      updatePayload.timer_elapsed_seconds = 0;
    }

    const { data: updated, error: updateError } = await admin
      .from("event_sessions")
      .update(updatePayload)
      .eq("id", session.id)
      .select(
        "id, event_id, status, opens_at, closes_at, chunk_size, current_chunk_start, active_signup_id, timer_started_at, timer_elapsed_seconds",
      )
      .single();

    if (updateError || !updated) throw new Error(updateError?.message || "Failed to update session state");

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
    }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400, req);
  }
});
