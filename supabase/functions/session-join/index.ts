import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireUser, getEvent } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { sha256 } from "../_shared/security.ts";

interface SessionJoinBody {
  eventId?: string;
  token?: string;
  pin?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SessionJoinBody;
    if (!body.eventId) throw new Error("eventId is required");

    const admin = createAdminClient();
    const user = await requireUser(req, admin);
    const event = await getEvent(admin, body.eventId);

    await admin.from("chapter_memberships").upsert(
      {
        chapter_id: event.chapter_id,
        user_id: user.id,
        role: "member",
      },
      { onConflict: "chapter_id,user_id", ignoreDuplicates: true },
    );

    const { data: session, error: sessionError } = await admin
      .from("event_sessions")
      .select("status, opens_at, closes_at, qr_token_hash, pin_hash")
      .eq("event_id", body.eventId)
      .single();

    if (sessionError || !session) {
      throw new Error("Session is not available");
    }

    if (session.status !== "open") {
      return jsonResponse({ allowed: false, message: "Signup window is closed" });
    }

    const now = new Date();
    if (session.opens_at && now < new Date(session.opens_at)) {
      return jsonResponse({ allowed: false, message: "Signup has not opened yet" });
    }

    if (session.closes_at && now > new Date(session.closes_at)) {
      return jsonResponse({ allowed: false, message: "Signup window is closed" });
    }

    const matchesToken = body.token ? (await sha256(body.token)) === session.qr_token_hash : false;
    const matchesPin = body.pin ? (await sha256(body.pin)) === session.pin_hash : false;

    if (!matchesToken && !matchesPin) {
      return jsonResponse({ allowed: false, message: "Invalid QR token or PIN" });
    }

    return jsonResponse({
      allowed: true,
      message: "Access granted",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ allowed: false, message }, 400);
  }
});
