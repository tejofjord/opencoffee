import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("notification digest contract", () => {
  const fnPath = resolve(process.cwd(), "supabase/functions/notification-digest/index.ts");
  const source = readFileSync(fnPath, "utf8");

  it("uses Resend delivery path", () => {
    expect(source).toContain("https://api.resend.com/emails");
    expect(source).toContain("RESEND_API_KEY");
  });

  it("records failed deliveries", () => {
    expect(source).toContain("status: nextStatus");
    expect(source).toContain("error: errorPayload");
  });
});
