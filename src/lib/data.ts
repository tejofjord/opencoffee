import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { EventRecord, EventSession, QueueItem } from "../types/domain";

export async function getPrimaryMembership(user: User) {
  const { data, error } = await supabase
    .from("chapter_memberships")
    .select("chapter_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getEventsForChapter(chapterId: string): Promise<EventRecord[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id, chapter_id, title, venue, starts_at, ends_at, status")
    .eq("chapter_id", chapterId)
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    chapterId: row.chapter_id,
    title: row.title,
    venue: row.venue,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
  }));
}

export async function getSessionForEvent(eventId: string): Promise<EventSession | null> {
  const { data, error } = await supabase
    .from("event_sessions")
    .select(
      "id, event_id, status, opens_at, closes_at, chunk_size, current_chunk_start, active_signup_id, timer_started_at, timer_elapsed_seconds",
    )
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    eventId: data.event_id,
    status: data.status,
    opensAt: data.opens_at,
    closesAt: data.closes_at,
    chunkSize: data.chunk_size,
    currentChunkStart: data.current_chunk_start,
    activeSignupId: data.active_signup_id,
    timerStartedAt: data.timer_started_at,
    timerElapsedSeconds: data.timer_elapsed_seconds,
  };
}

export async function getQueueForEvent(eventId: string): Promise<QueueItem[]> {
  const { data, error } = await supabase
    .from("event_signups")
    .select(
      "id, event_id, user_id, who, project, need, can_help, website_url, linkedin_url, queue_position, status, profiles(display_name)",
    )
    .eq("event_id", eventId)
    .order("queue_position", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    // Supabase relationship typing can return object or single-item array depending on schema cache.
    ...(() => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return {
        id: row.id,
        eventId: row.event_id,
        userId: row.user_id,
        profileName: profile?.display_name ?? "Presenter",
        who: row.who,
        project: row.project,
        need: row.need,
        canHelp: row.can_help,
        websiteUrl: row.website_url,
        linkedinUrl: row.linkedin_url,
        queuePosition: row.queue_position,
        status: row.status,
        active: false,
      };
    })(),
  }));
}
