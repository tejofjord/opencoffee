import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireChapterMember, requireUser } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";

interface ReportCreateBody {
  chapterId?: string;
  reportedUserId?: string;
  reason?: string;
  context?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const body = (await req.json()) as ReportCreateBody;
    if (!body.chapterId || !body.reportedUserId || !body.reason) {
      throw new Error("chapterId, reportedUserId and reason are required");
    }

    const admin = createAdminClient();
    const user = await requireUser(req, admin);

    if (body.reportedUserId === user.id) {
      throw new Error("Cannot report yourself");
    }

    await requireChapterMember(admin, body.chapterId, user.id);
    await requireChapterMember(admin, body.chapterId, body.reportedUserId);

    const { data, error } = await admin
      .from("reports")
      .insert({
        chapter_id: body.chapterId,
        reporter_id: user.id,
        reported_user_id: body.reportedUserId,
        reason: body.reason,
        context: body.context?.trim() || null,
        status: "open",
      })
      .select("id")
      .single();

    if (error || !data) throw new Error(error?.message || "Failed to create report");

    return jsonResponse({ reportId: data.id }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400, req);
  }
});
