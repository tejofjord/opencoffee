# Architecture

## Stack

1. Frontend
   - Vite + React + TypeScript
   - Supabase JS client
   - React Router routes under `/`, `/auth`, `/app/*`
2. Backend
   - Supabase Postgres with RLS
   - Supabase Edge Functions (Deno)
   - Supabase Auth (magic link)
3. Notifications
   - In-app notification jobs in Postgres (`notification_jobs`)
   - Digest email dispatch via Resend

## Core Domains

1. Chapters and memberships
2. Events and event sessions
3. Event signups and presenter queue
4. Networking requests, conversations, and messages
5. Safety controls (blocks and reports)
6. Audit and notification operations

## Trust Boundaries

1. Public/unauthenticated
   - Landing page and public event feed function.
2. Authenticated chapter members
   - Join flow, network, inbox/chat, report creation.
3. Organizer/admin only
   - Session open/close, queue mutation, event CRUD, moderation resolution.
4. Service-role function boundary
   - Edge functions execute privileged operations with explicit role checks in logic.
5. Database boundary
   - RLS is the final data access gate for table reads/writes.

## Runtime Flow Overview

1. Event-day join and signup
   - Organizer opens session -> token/PIN issued.
   - Attendee verifies session via token/PIN.
   - Attendee submits intro answers and optional links.
   - Signup is inserted/updated with deterministic queue position.
2. Organizer queue and projector
   - Organizer reorders queue (drag/drop or fallback controls).
   - Active presenter and timer state are managed from organizer console.
   - Projector view reflects live session/queue state.
3. Post-event networking
   - Graph loads chapter-scoped presenters and accepted edges.
   - Member sends help request.
   - Recipient accepts/declines.
   - Accepted request creates/reuses 1:1 conversation.
4. Safety and moderation
   - Member can block/report.
   - Block supersedes networking/chat visibility.
   - Organizer/admin resolves reports and actions are audited.

## Realtime Surfaces

1. Organizer event console subscribes to:
   - `event_signups` changes for queue updates.
   - `event_sessions` changes for session/timer/chunk updates.
2. Inbox/chat and network pages rely on fresh queries and function mutations.

