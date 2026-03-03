import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireUser, getEvent } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { getRetryAfterSeconds, getWindowStartedAt, remainingAttempts } from "../_shared/rateLimit.ts";
import { sha256 } from "../_shared/security.ts";

interface SessionJoinBody {
  eventId?: string;
  token?: string;
  pin?: string;
}

const USER_ATTEMPT_LIMIT = 10;
const IP_ATTEMPT_LIMIT = 25;

function getSourceIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const body = (await req.json()) as SessionJoinBody;
    if (!body.eventId) throw new Error("eventId is required");

    const admin = createAdminClient();
    const user = await requireUser(req, admin);
    const event = await getEvent(admin, body.eventId);
    const sourceIp = getSourceIp(req);
    const nowMs = Date.now();
    const windowStartedAt = getWindowStartedAt(nowMs);
    const retryAfterSeconds = getRetryAfterSeconds(nowMs);

    const [{ data: userAttemptRows, error: userAttemptError }, { data: ipAttemptRows, error: ipAttemptError }] =
      await Promise.all([
        admin
          .from("session_join_attempts")
          .select("attempt_count")
          .eq("event_id", body.eventId)
          .eq("user_id", user.id)
          .eq("window_started_at", windowStartedAt),
        admin
          .from("session_join_attempts")
          .select("attempt_count")
          .eq("event_id", body.eventId)
          .eq("source_ip", sourceIp)
          .eq("window_started_at", windowStartedAt),
      ]);

    if (userAttemptError) throw new Error(userAttemptError.message);
    if (ipAttemptError) throw new Error(ipAttemptError.message);

    const userAttempts = (userAttemptRows ?? []).reduce((sum, row) => sum + row.attempt_count, 0);
    const ipAttempts = (ipAttemptRows ?? []).reduce((sum, row) => sum + row.attempt_count, 0);
    const blockedByLimit = userAttempts >= USER_ATTEMPT_LIMIT || ipAttempts >= IP_ATTEMPT_LIMIT;
    if (blockedByLimit) {
      return jsonResponse({
        allowed: false,
        message: "Too many invalid attempts. Try again shortly.",
        remainingAttempts: 0,
        retryAfterSeconds,
      }, 200, req);
    }

    const { data: session, error: sessionError } = await admin
      .from("event_sessions")
      .select("status, opens_at, closes_at, qr_token_hash, pin_hash")
      .eq("event_id", body.eventId)
      .single();

    if (sessionError || !session) {
      throw new Error("Session is not available");
    }

    if (session.status !== "open") {
      return jsonResponse({ allowed: false, message: "Signup window is closed" }, 200, req);
    }

    const now = new Date();
    if (session.opens_at && now < new Date(session.opens_at)) {
      return jsonResponse({ allowed: false, message: "Signup has not opened yet" }, 200, req);
    }

    if (session.closes_at && now > new Date(session.closes_at)) {
      return jsonResponse({ allowed: false, message: "Signup window is closed" }, 200, req);
    }

    const matchesToken = body.token ? (await sha256(body.token)) === session.qr_token_hash : false;
    const matchesPin = body.pin ? (await sha256(body.pin)) === session.pin_hash : false;

    if (!matchesToken && !matchesPin) {
      const { data: existingRow, error: existingError } = await admin
        .from("session_join_attempts")
        .select("id, attempt_count")
        .eq("event_id", body.eventId)
        .eq("user_id", user.id)
        .eq("source_ip", sourceIp)
        .eq("window_started_at", windowStartedAt)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);

      const nextCount = (existingRow?.attempt_count ?? 0) + 1;

      if (existingRow?.id) {
        const { error: updateAttemptError } = await admin
          .from("session_join_attempts")
          .update({
            attempt_count: nextCount,
            last_attempt_at: new Date(nowMs).toISOString(),
          })
          .eq("id", existingRow.id);
        if (updateAttemptError) throw new Error(updateAttemptError.message);
      } else {
        const { error: insertAttemptError } = await admin.from("session_join_attempts").insert({
          event_id: body.eventId,
          user_id: user.id,
          source_ip: sourceIp,
          window_started_at: windowStartedAt,
          attempt_count: 1,
          last_attempt_at: new Date(nowMs).toISOString(),
        });
        if (insertAttemptError) throw new Error(insertAttemptError.message);
      }

      const nextUserAttempts = userAttempts + 1;
      const nextIpAttempts = ipAttempts + 1;
      const remainingAttemptsValue = remainingAttempts(
        nextUserAttempts,
        nextIpAttempts,
        USER_ATTEMPT_LIMIT,
        IP_ATTEMPT_LIMIT,
      );
      const throttled = remainingAttemptsValue <= 0;

      return jsonResponse(
        {
          allowed: false,
          message: throttled ? "Too many invalid attempts. Try again shortly." : "Invalid QR token or PIN",
          remainingAttempts: remainingAttemptsValue,
          retryAfterSeconds: throttled ? retryAfterSeconds : undefined,
        },
        200,
        req,
      );
    }

    await admin.from("chapter_memberships").upsert(
      {
        chapter_id: event.chapter_id,
        user_id: user.id,
        role: "member",
      },
      { onConflict: "chapter_id,user_id", ignoreDuplicates: true },
    );

    await admin
      .from("session_join_attempts")
      .delete()
      .eq("event_id", body.eventId)
      .eq("user_id", user.id)
      .eq("window_started_at", windowStartedAt);

    return jsonResponse({
      allowed: true,
      message: "Access granted",
      remainingAttempts: remainingAttempts(
        userAttempts,
        ipAttempts,
        USER_ATTEMPT_LIMIT,
        IP_ATTEMPT_LIMIT,
      ),
    }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ allowed: false, message }, 400, req);
  }
});
