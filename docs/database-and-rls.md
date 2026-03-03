# Database And RLS

## Migration Inventory

1. `supabase/migrations/20260228160000_initial_schema.sql`
   - Base schema, enums, indexes, helper functions, baseline RLS.
2. `supabase/migrations/20260302120000_remediation_phase1.sql`
   - Rate-limit table, queue reorder function, block helper, policy hardening, notification error field.
3. `supabase/migrations/20260302130500_phase1_followups.sql`
   - Atomic signup upsert function and additional block-aware policy hardening for request/conversation writes.

## Core Tables

1. Identity and chapter scope
   - `profiles`
   - `chapters`
   - `chapter_memberships`
2. Event lifecycle
   - `events`
   - `event_sessions`
   - `event_signups`
3. Networking and chat
   - `connection_requests`
   - `conversations`
   - `messages`
4. Safety and ops
   - `user_blocks`
   - `reports`
   - `notification_jobs`
   - `audit_logs`
   - `session_join_attempts`

## Key Integrity Constraints

1. Queue uniqueness
   - `event_signups` has unique `(event_id, queue_position)`.
2. One signup per user per event
   - `event_signups` unique `(event_id, user_id)`.
3. One pending connection request per pair/type/chapter
   - Partial unique index on `connection_requests`.
4. One conversation per pair/chapter
   - `conversations` unique `(chapter_id, user_a_id, user_b_id)`.

## Security Helper Functions

1. `public.is_chapter_member(chapter_id uuid)`
2. `public.is_chapter_organizer(chapter_id uuid)`
3. `public.is_blocked(chapter_id uuid, a uuid, b uuid)`
4. `public.reorder_event_queue(...)`
5. `public.next_queue_position(...)`
6. `public.upsert_event_signup(...)`

## RLS Model Highlights

1. Membership scope
   - Reads and writes require chapter membership unless explicitly public.
2. Organizer privileges
   - Queue/session/moderation mutations restricted to organizer/admin role.
3. Block supersedes visibility
   - Profiles/signups/requests/conversations/messages are hidden or write-restricted when blocked.
4. Signup self-edit window
   - Self updates to `event_signups` only allowed while session is open and within open/close bounds.
5. Report privacy
   - Reports are visible to reporter and chapter organizers/admins only.

## Session Join Abuse Control

1. `session_join_attempts` tracks failed attempts keyed by user + IP + event + window.
2. `session-join` enforces:
   - max 10 failed attempts per user/event/10-minute window
   - max 25 failed attempts per IP/event/10-minute window

