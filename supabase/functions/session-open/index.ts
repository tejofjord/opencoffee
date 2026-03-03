import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireOrganizer, requireUser, getEvent } from "../_shared/auth.ts";
import { randomPin, sha256 } from "../_shared/security.ts";
import { createAdminClient } from "../_shared/supabase.ts";

interface SessionOpenBody {
  eventId?: string;
  opensAt?: string;
  closesAt?: string;
  chunkSize?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const body = (await req.json()) as SessionOpenBody;
    if (!body.eventId) throw new Error("eventId is required");

    const admin = createAdminClient();
    const user = await requireUser(req, admin);
    const event = await getEvent(admin, body.eventId);
    await requireOrganizer(admin, event.chapter_id, user.id);

    const token = crypto.randomUUID();
    const pin = randomPin();

    const tokenHash = await sha256(token);
    const pinHash = await sha256(pin);
    const chunkSize = body.chunkSize && body.chunkSize > 0 ? body.chunkSize : 10;

    const now = new Date();
    const opensAt = body.opensAt ? new Date(body.opensAt).toISOString() : now.toISOString();
    const closesAt = body.closesAt ? new Date(body.closesAt).toISOString() : event.ends_at;

    const { data, error } = await admin
      .from("event_sessions")
      .upsert(
        {
          event_id: body.eventId,
          status: "open",
          opens_at: opensAt,
          closes_at: closesAt,
          qr_token_hash: tokenHash,
          pin_hash: pinHash,
          chunk_size: chunkSize,
          current_chunk_start: 0,
          timer_elapsed_seconds: 0,
          timer_started_at: null,
          updated_by: user.id,
          created_by: user.id,
        },
        { onConflict: "event_id" },
      )
      .select(
        "id, event_id, status, opens_at, closes_at, chunk_size, current_chunk_start, active_signup_id, timer_started_at, timer_elapsed_seconds",
      )
      .single();

    if (error || !data) throw new Error(error?.message || "Failed to open session");

    await admin.from("audit_logs").insert({
      chapter_id: event.chapter_id,
      actor_id: user.id,
      action: "session_open",
      entity_type: "event",
      entity_id: body.eventId,
      payload: {
        opensAt,
        closesAt,
        chunkSize,
      },
    });

    const baseUrl = (
      Deno.env.get("APP_BASE_URL") || req.headers.get("origin") || "http://localhost:5173"
    ).replace(/\/+$/, "");

    return jsonResponse({
      joinUrl: `${baseUrl}/app/events/${body.eventId}/join?token=${token}`,
      pin,
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
