import { describe, expect, it } from "vitest";
import { getRetryAfterSeconds, getWindowStartedAt, remainingAttempts } from "../../supabase/functions/_shared/rateLimit";

describe("session join rate limit helpers", () => {
  it("computes deterministic window boundary", () => {
    const now = Date.parse("2026-03-02T10:07:35.000Z");
    expect(getWindowStartedAt(now)).toBe("2026-03-02T10:00:00.000Z");
  });

  it("computes retry-after within 10-minute window", () => {
    const now = Date.parse("2026-03-02T10:07:35.000Z");
    expect(getRetryAfterSeconds(now)).toBe(145);
  });

  it("returns remaining attempts from tightest limit", () => {
    expect(remainingAttempts(0, 0, 10, 25)).toBe(10);
    expect(remainingAttempts(7, 20, 10, 25)).toBe(3);
    expect(remainingAttempts(11, 20, 10, 25)).toBe(0);
  });
});
