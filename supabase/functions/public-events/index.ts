import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

interface PublicEventsBody {
  limit?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const body = req.method === "POST" ? ((await req.json()) as PublicEventsBody) : {};
    const limit = Math.min(Math.max(body.limit ?? 6, 1), 30);

    const admin = createAdminClient();
    const nowIso = new Date().toISOString();

    const { data, error } = await admin
      .from("events")
      .select("id, chapter_id, title, venue, starts_at, ends_at, status, chapters(name, slug)")
      .eq("status", "published")
      .gte("starts_at", nowIso)
      .order("starts_at", { ascending: true })
      .limit(limit);

    if (error) throw new Error(error.message);

    const events = (data ?? []).map((row) => {
      const chapter = Array.isArray(row.chapters) ? row.chapters[0] : row.chapters;
      return {
        id: row.id,
        chapterId: row.chapter_id,
        chapterName: chapter?.name ?? "OpenCoffee Chapter",
        chapterSlug: chapter?.slug ?? null,
        title: row.title,
        venue: row.venue,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        status: row.status,
      };
    });

    return jsonResponse({ events }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400, req);
  }
});
