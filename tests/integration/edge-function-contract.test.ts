import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("edge function remediation contract", () => {
  it("session-join validates token/pin before membership upsert and includes throttle metadata", () => {
    const fn = source("supabase/functions/session-join/index.ts");
    expect(fn).toContain("if (!matchesToken && !matchesPin)");
    expect(fn).toContain("remainingAttempts");
    expect(fn).toContain("retryAfterSeconds");

    const invalidCheckIndex = fn.indexOf("if (!matchesToken && !matchesPin)");
    const membershipUpsertIndex = fn.indexOf('await admin.from("chapter_memberships").upsert');
    expect(invalidCheckIndex).toBeGreaterThanOrEqual(0);
    expect(membershipUpsertIndex).toBeGreaterThan(invalidCheckIndex);
  });

  it("signup-upsert uses atomic queue RPC", () => {
    const fn = source("supabase/functions/signup-upsert/index.ts");
    expect(fn).toContain('rpc("upsert_event_signup"');
    expect(fn).toContain("p_event_id");
    expect(fn).toContain("p_user_id");
  });

  it("queue-reorder delegates to deterministic SQL RPC", () => {
    const fn = source("supabase/functions/queue-reorder/index.ts");
    expect(fn).toContain('rpc("reorder_event_queue"');
    expect(fn).toContain("p_ordered_signup_ids");
  });
});
