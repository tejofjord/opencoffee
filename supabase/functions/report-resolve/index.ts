import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireOrganizer, requireUser } from "../_shared/auth.ts";
import { createAdminClient } from "../_shared/supabase.ts";

interface ReportResolveBody {
  reportId?: string;
  status?: "resolved" | "dismissed";
  resolutionNote?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ReportResolveBody;
    if (!body.reportId || !body.status) throw new Error("reportId and status are required");

    const admin = createAdminClient();
    const user = await requireUser(req, admin);

    const { data: report, error: reportError } = await admin
      .from("reports")
      .select("id, chapter_id")
      .eq("id", body.reportId)
      .single();

    if (reportError || !report) throw new Error("Report not found");

    await requireOrganizer(admin, report.chapter_id, user.id);

    const { error: updateError } = await admin
      .from("reports")
      .update({
        status: body.status,
        resolution_note: body.resolutionNote?.trim() || null,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", body.reportId);

    if (updateError) throw new Error(updateError.message);

    await admin.from("audit_logs").insert({
      chapter_id: report.chapter_id,
      actor_id: user.id,
      action: "report_resolve",
      entity_type: "report",
      entity_id: body.reportId,
      payload: { status: body.status },
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400);
  }
});
