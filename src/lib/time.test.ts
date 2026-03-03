import { describe, expect, it } from "vitest";
import { clamp } from "./time";

describe("time helpers", () => {
  it("clamps values to inclusive range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(20, 0, 10)).toBe(10);
  });
});
