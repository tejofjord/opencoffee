import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

interface DigestItem {
  id: string;
  user_id: string;
  kind: string;
  payload: Record<string, unknown>;
}

function isAuthorized(req: Request): boolean {
  const expected = Deno.env.get("DIGEST_CRON_TOKEN");
  if (!expected) return true;
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  return token === expected;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!isAuthorized(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("notification_jobs")
      .select("id, user_id, kind, payload")
      .eq("status", "pending")
      .lte("run_at", new Date().toISOString())
      .order("run_at", { ascending: true })
      .limit(250);

    if (error) throw new Error(error.message);

    const jobs = (data ?? []) as DigestItem[];
    if (jobs.length === 0) {
      return jsonResponse({ processed: 0, users: 0 });
    }

    const grouped = new Map<string, DigestItem[]>();
    for (const job of jobs) {
      const key = `${job.user_id}:${job.kind}`;
      const current = grouped.get(key) ?? [];
      current.push(job);
      grouped.set(key, current);
    }

    let sentCount = 0;

    for (const [key, items] of grouped.entries()) {
      const [userId, kind] = key.split(":");
      const ids = items.map((item) => item.id);

      // Placeholder mail dispatch hook.
      // Integrate provider-specific delivery here (Resend, Postmark, SES, etc.).
      const delivered = true;

      const nextStatus = delivered ? "sent" : "failed";
      const { error: updateError } = await admin
        .from("notification_jobs")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .in("id", ids);

      if (updateError) throw new Error(updateError.message);

      await admin.from("audit_logs").insert({
        chapter_id: (items[0].payload?.chapterId as string | undefined) ?? (await resolveChapterId(admin, userId)),
        actor_id: null,
        action: "notification_digest_dispatch",
        entity_type: "notification_jobs",
        entity_id: null,
        payload: {
          userId,
          kind,
          count: ids.length,
          status: nextStatus,
        },
      });

      sentCount += ids.length;
    }

    return jsonResponse({
      processed: jobs.length,
      users: grouped.size,
      markedSent: sentCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400);
  }
});

async function resolveChapterId(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const membership = await admin
    .from("chapter_memberships")
    .select("chapter_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return membership.data?.chapter_id ?? null;
}
