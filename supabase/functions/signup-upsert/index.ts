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
    return new Response("ok", { headers: corsHeaders(req) });
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

    const signupFields = {
      who: body.who.trim(),
      project: body.project.trim(),
      need: body.need.trim(),
      can_help: body.canHelp.trim(),
      website_url: sanitizeUrl(body.websiteUrl),
      linkedin_url: sanitizeUrl(body.linkedinUrl),
      short_bio: body.shortBio?.trim() || null,
    };

    const { data: upsertedRows, error: upsertError } = await admin.rpc("upsert_event_signup", {
      p_event_id: body.eventId,
      p_user_id: user.id,
      p_who: signupFields.who,
      p_project: signupFields.project,
      p_need: signupFields.need,
      p_can_help: signupFields.can_help,
      p_website_url: signupFields.website_url,
      p_linkedin_url: signupFields.linkedin_url,
      p_short_bio: signupFields.short_bio,
    });
    if (upsertError) throw new Error(upsertError.message);

    const upserted = Array.isArray(upsertedRows) ? upsertedRows[0] : upsertedRows;
    if (!upserted?.signup_id || typeof upserted.queue_position !== "number") {
      throw new Error("Failed to save signup");
    }

    return jsonResponse({
      signupId: upserted.signup_id,
      queuePosition: upserted.queue_position,
    }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400, req);
  }
});
