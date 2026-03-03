import type { SupabaseClient, User } from "npm:@supabase/supabase-js@2";

export async function requireUser(req: Request, admin: SupabaseClient): Promise<User> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    throw new Error("Missing bearer token");
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("Invalid session token");
  }

  return data.user;
}

export async function isSuperAdmin(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("profiles")
    .select("is_superadmin")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return false;
  return data?.is_superadmin === true;
}

export async function requireSuperAdmin(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const sa = await isSuperAdmin(admin, userId);
  if (!sa) throw new Error("Superadmin role required");
}

export async function getEvent(admin: SupabaseClient, eventId: string) {
  const { data, error } = await admin
    .from("events")
    .select("id, chapter_id, starts_at, ends_at")
    .eq("id", eventId)
    .single();

  if (error || !data) throw new Error("Event not found");
  return data;
}

export async function getMembershipRole(
  admin: SupabaseClient,
  chapterId: string,
  userId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("chapter_memberships")
    .select("role")
    .eq("chapter_id", chapterId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.role ?? null;
}

export async function requireChapterMember(
  admin: SupabaseClient,
  chapterId: string,
  userId: string,
): Promise<void> {
  if (await isSuperAdmin(admin, userId)) return;
  const role = await getMembershipRole(admin, chapterId, userId);
  if (!role) throw new Error("Chapter membership required");
}

export async function requireOrganizer(
  admin: SupabaseClient,
  chapterId: string,
  userId: string,
): Promise<void> {
  if (await isSuperAdmin(admin, userId)) return;
  const role = await getMembershipRole(admin, chapterId, userId);
  if (!role || (role !== "organizer" && role !== "admin")) {
    throw new Error("Organizer role required");
  }
}

export async function assertConversationParticipant(
  admin: SupabaseClient,
  conversationId: string,
  userId: string,
) {
  const { data, error } = await admin
    .from("conversations")
    .select("id, chapter_id, user_a_id, user_b_id")
    .eq("id", conversationId)
    .single();

  if (error || !data) throw new Error("Conversation not found");
  if (data.user_a_id !== userId && data.user_b_id !== userId) {
    // Superadmins can access any conversation
    if (!(await isSuperAdmin(admin, userId))) {
      throw new Error("Not a conversation participant");
    }
  }

  return data;
}

export async function assertNotBlocked(
  admin: SupabaseClient,
  chapterId: string,
  userA: string,
  userB: string,
): Promise<void> {
  const { count, error } = await admin
    .from("user_blocks")
    .select("id", { count: "exact", head: true })
    .eq("chapter_id", chapterId)
    .or(
      [
        `and(blocker_id.eq.${userA},blocked_id.eq.${userB})`,
        `and(blocker_id.eq.${userB},blocked_id.eq.${userA})`,
      ].join(","),
    );

  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) {
    throw new Error("Communication blocked");
  }
}
