export type Role = "member" | "organizer" | "admin";
export type SessionStatus = "open" | "closed";
export type SignupStatus = "queued" | "presented" | "skipped";
export type ConnectionRequestType = "need_help" | "can_help";
export type ConnectionRequestStatus = "pending" | "accepted" | "declined" | "cancelled";
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

export interface IntroAnswers {
  who: string;
  project: string;
  need: string;
  canHelp: string;
}

export interface SignupSubmission extends IntroAnswers {
  eventId: string;
  websiteUrl?: string;
  linkedinUrl?: string;
  shortBio?: string;
  sessionToken?: string;
  sessionPin?: string;
}

export interface QueueItem {
  id: string;
  eventId: string;
  userId: string;
  profileName: string;
  who: string;
  project: string;
  need: string;
  canHelp: string;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  queuePosition: number;
  status: SignupStatus;
  active: boolean;
}

export interface ConnectionRequest {
  id: string;
  chapterId: string;
  eventId: string | null;
  requesterId: string;
  targetUserId: string;
  requesterName: string | null;
  targetName: string | null;
  requestType: ConnectionRequestType;
  message: string | null;
  status: ConnectionRequestStatus;
  createdAt: string;
}

export interface GraphNode {
  id: string;
  label: string;
  need: string;
  canHelp: string;
  bio: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: ConnectionRequestType;
}

export interface ModerationReport {
  id: string;
  chapterId: string;
  reporterId: string;
  reportedUserId: string;
  reporterName: string | null;
  reportedName: string | null;
  reason: string;
  context: string | null;
  status: ReportStatus;
  resolutionNote: string | null;
  createdAt: string;
}

export interface EventRecord {
  id: string;
  chapterId: string;
  title: string;
  venue: string | null;
  startsAt: string;
  endsAt: string;
  status: "draft" | "published" | "cancelled";
}

export interface EventSession {
  id: string;
  eventId: string;
  status: SessionStatus;
  opensAt: string | null;
  closesAt: string | null;
  chunkSize: number;
  currentChunkStart: number;
  activeSignupId: string | null;
  timerStartedAt: string | null;
  timerElapsedSeconds: number;
}
