import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";

interface DigestItem {
  id: string;
  user_id: string;
  kind: string;
  payload: Record<string, unknown>;
}

interface DeliveryResult {
  ok: boolean;
  error?: string;
}

function isAuthorized(req: Request): boolean {
  const expected = Deno.env.get("DIGEST_CRON_TOKEN");
  if (!expected) return true;
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  return token === expected;
}

function buildDigestSubject(kind: string, count: number): string {
  switch (kind) {
    case "message_digest":
      return `OpenCoffee: ${count} new message${count === 1 ? "" : "s"}`;
    default:
      return `OpenCoffee: ${count} new notification${count === 1 ? "" : "s"}`;
  }
}

function buildDigestHtml(kind: string, count: number, appBaseUrl: string): string {
  const inboxUrl = `${appBaseUrl.replace(/\/+$/, "")}/app/inbox`;
  return `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="margin: 0 0 12px;">OpenCoffee Digest</h2>
      <p style="margin: 0 0 10px;">
        You have <strong>${count}</strong> pending update${count === 1 ? "" : "s"} in your OpenCoffee account.
      </p>
      <p style="margin: 0 0 18px;">Type: <strong>${kind}</strong></p>
      <a href="${inboxUrl}" style="display:inline-block;background:#0f766e;color:white;padding:10px 14px;border-radius:8px;text-decoration:none;">
        Open Inbox
      </a>
    </div>
  `;
}

async function sendDigestEmail(
  to: string,
  subject: string,
  html: string,
): Promise<DeliveryResult> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }

  const from = Deno.env.get("RESEND_FROM") || "OpenCoffee <noreply@opencoff.ee>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  if (response.ok) {
    return { ok: true };
  }

  const body = await response.text();
  return {
    ok: false,
    error: `Resend API error (${response.status}): ${body.slice(0, 500)}`,
  };
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
    let failedCount = 0;

    for (const [key, items] of grouped.entries()) {
      const [userId, kind] = key.split(":");
      const ids = items.map((item) => item.id);

      const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
      const toEmail = userData.user?.email;

      let delivery: DeliveryResult;

      if (userError || !toEmail) {
        delivery = {
          ok: false,
          error: userError?.message || "Target user email is missing",
        };
      } else {
        const appBaseUrl = Deno.env.get("APP_BASE_URL") || req.headers.get("origin") || "http://localhost:5173";
        delivery = await sendDigestEmail(
          toEmail,
          buildDigestSubject(kind, ids.length),
          buildDigestHtml(kind, ids.length, appBaseUrl),
        );
      }

      const nextStatus = delivery.ok ? "sent" : "failed";
      const errorPayload = delivery.ok
        ? null
        : {
            message: delivery.error || "Unknown delivery error",
            failedAt: new Date().toISOString(),
          };

      const { error: updateError } = await admin
        .from("notification_jobs")
        .update({
          status: nextStatus,
          error: errorPayload,
          updated_at: new Date().toISOString(),
        })
        .in("id", ids);

      if (updateError) throw new Error(updateError.message);

      const chapterId =
        (items[0].payload?.chapterId as string | undefined) ?? (await resolveChapterId(admin, userId));
      if (chapterId) {
        await admin.from("audit_logs").insert({
          chapter_id: chapterId,
          actor_id: null,
          action: "notification_digest_dispatch",
          entity_type: "notification_jobs",
          entity_id: null,
          payload: {
            userId,
            kind,
            count: ids.length,
            status: nextStatus,
            error: errorPayload,
          },
        });
      }

      if (delivery.ok) {
        sentCount += ids.length;
      } else {
        failedCount += ids.length;
      }
    }

    return jsonResponse({
      processed: jobs.length,
      users: grouped.size,
      markedSent: sentCount,
      failed: failedCount,
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
