import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireChapterMember, requireUser, getEvent } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { sanitizeUrl, sha256 } from "../_shared/security.ts";

interface SignupUpsertBody {
  eventId?: string;
  who?: string;
  project?: string;
  need?: string;
  canHelp?: string;
  websiteUrl?: string;
  linkedinUrl?: string;
  shortBio?: string;
  sessionToken?: string;
  sessionPin?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SignupUpsertBody;

    if (!body.eventId) throw new Error("eventId is required");
    if (!body.who?.trim() || !body.project?.trim() || !body.need?.trim() || !body.canHelp?.trim()) {
      throw new Error("All four intro answers are required");
    }

    const admin = createAdminClient();
    const user = await requireUser(req, admin);
    const event = await getEvent(admin, body.eventId);
    await requireChapterMember(admin, event.chapter_id, user.id);

    const { data: session, error: sessionError } = await admin
      .from("event_sessions")
      .select("status, opens_at, closes_at, qr_token_hash, pin_hash")
      .eq("event_id", body.eventId)
      .single();

    if (sessionError || !session || session.status !== "open") {
      throw new Error("Signup window is not open");
    }

    const now = new Date();
    if (session.opens_at && now < new Date(session.opens_at)) {
      throw new Error("Signup has not opened yet");
    }
    if (session.closes_at && now > new Date(session.closes_at)) {
      throw new Error("Signup is closed");
    }

    const tokenMatch = body.sessionToken
      ? (await sha256(body.sessionToken)) === session.qr_token_hash
      : false;
    const pinMatch = body.sessionPin ? (await sha256(body.sessionPin)) === session.pin_hash : false;

    if (!tokenMatch && !pinMatch) {
      throw new Error("Valid token or PIN is required");
    }

    const { data: existing } = await admin
      .from("event_signups")
      .select("id, queue_position")
      .eq("event_id", body.eventId)
      .eq("user_id", user.id)
      .maybeSingle();

    let queuePosition = existing?.queue_position;
    if (!queuePosition) {
      const { data: maxRows } = await admin
        .from("event_signups")
        .select("queue_position")
        .eq("event_id", body.eventId)
        .order("queue_position", { ascending: false })
        .limit(1);
      queuePosition = (maxRows?.[0]?.queue_position ?? 0) + 1;
    }

    const payload = {
      event_id: body.eventId,
      user_id: user.id,
      who: body.who.trim(),
      project: body.project.trim(),
      need: body.need.trim(),
      can_help: body.canHelp.trim(),
      website_url: sanitizeUrl(body.websiteUrl),
      linkedin_url: sanitizeUrl(body.linkedinUrl),
      short_bio: body.shortBio?.trim() || null,
      queue_position: queuePosition,
      status: "queued",
    };

    const { data: signup, error: upsertError } = await admin
      .from("event_signups")
      .upsert(payload, { onConflict: "event_id,user_id" })
      .select("id, queue_position")
      .single();

    if (upsertError || !signup) throw new Error(upsertError?.message || "Failed to save signup");

    return jsonResponse({
      signupId: signup.id,
      queuePosition: signup.queue_position,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400);
  }
});
