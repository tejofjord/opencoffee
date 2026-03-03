import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("remediation migration contract", () => {
  const migrationDir = resolve(process.cwd(), "supabase/migrations");
  const sql = readdirSync(migrationDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(resolve(migrationDir, file), "utf8"))
    .join("\n");

  it("creates rate-limit table for session join attempts", () => {
    expect(sql).toContain("create table if not exists public.session_join_attempts");
    expect(sql).toContain("unique (event_id, user_id, source_ip, window_started_at)");
  });

  it("adds queue helper functions for deterministic ordering", () => {
    expect(sql).toContain("create or replace function public.next_queue_position");
    expect(sql).toContain("create or replace function public.reorder_event_queue");
    expect(sql).toContain("create or replace function public.upsert_event_signup");
  });

  it("patches blocking and signup policies", () => {
    expect(sql).toContain("create or replace function public.is_blocked");
    expect(sql).toContain("drop policy if exists signups_update_self_or_organizer");
    expect(sql).toContain("drop policy if exists conversations_read_participant");
    expect(sql).toContain("drop policy if exists requests_insert_self");
    expect(sql).toContain("drop policy if exists conversations_insert_participant");
  });
});
