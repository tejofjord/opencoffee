import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getEvent, requireOrganizer, requireUser } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";

interface EventUpsertBody {
  eventId?: string;
  chapterId?: string;
  title?: string;
  venue?: string | null;
  startsAt?: string;
  endsAt?: string;
  status?: "draft" | "published" | "cancelled";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const body = (await req.json()) as EventUpsertBody;
    if (!body.title?.trim()) throw new Error("title is required");
    if (!body.startsAt || !body.endsAt) throw new Error("startsAt and endsAt are required");

    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new Error("Invalid startsAt or endsAt");
    }
    if (endsAt <= startsAt) throw new Error("endsAt must be after startsAt");

    const admin = createAdminClient();
    const user = await requireUser(req, admin);
    const status = body.status ?? "published";
    if (!["draft", "published", "cancelled"].includes(status)) {
      throw new Error("status must be draft, published or cancelled");
    }

    if (body.eventId) {
      const event = await getEvent(admin, body.eventId);
      await requireOrganizer(admin, event.chapter_id, user.id);

      const { data, error } = await admin
        .from("events")
        .update({
          title: body.title.trim(),
          venue: body.venue?.trim() || null,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          status,
        })
        .eq("id", body.eventId)
        .select("id, chapter_id, title, venue, starts_at, ends_at, status")
        .single();

      if (error || !data) throw new Error(error?.message || "Failed to update event");

      await admin.from("audit_logs").insert({
        chapter_id: event.chapter_id,
        actor_id: user.id,
        action: "event_update",
        entity_type: "event",
        entity_id: body.eventId,
        payload: {
          status,
        },
      });

      return jsonResponse({ event: data }, 200, req);
    }

    if (!body.chapterId) throw new Error("chapterId is required when creating an event");
    await requireOrganizer(admin, body.chapterId, user.id);

    const { data, error } = await admin
      .from("events")
      .insert({
        chapter_id: body.chapterId,
        title: body.title.trim(),
        venue: body.venue?.trim() || null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status,
        created_by: user.id,
      })
      .select("id, chapter_id, title, venue, starts_at, ends_at, status")
      .single();

    if (error || !data) throw new Error(error?.message || "Failed to create event");

    await admin.from("audit_logs").insert({
      chapter_id: body.chapterId,
      actor_id: user.id,
      action: "event_create",
      entity_type: "event",
      entity_id: data.id,
      payload: {
        status,
      },
    });

    return jsonResponse({ event: data }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400, req);
  }
});
