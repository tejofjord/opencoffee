# Edge Functions

All function endpoints are exposed as Supabase Edge Functions under `/functions/v1/<name>`.

## Auth + Session + Signup

1. `session-open`
   - Role: organizer/admin for event chapter.
   - Input: `eventId`, optional `opensAt`, `closesAt`, `chunkSize`.
   - Output: `joinUrl`, `pin`, normalized `session`.
   - Notes: stores only hashed token/PIN and writes `session_open` audit log.
2. `session-close`
   - Role: organizer/admin.
   - Input: `eventId`.
   - Output: normalized `session`.
   - Notes: writes `session_close` audit log.
3. `session-join`
   - Role: authenticated user.
   - Input: `eventId`, optional `token`, optional `pin`.
   - Output: `allowed`, `message`, optional `remainingAttempts`, optional `retryAfterSeconds`.
   - Notes: validates open window and token/PIN first; chapter membership is inserted only on success.
4. `signup-upsert`
   - Role: authenticated chapter member.
   - Input: event ID, required 4-answer intro fields, optional website/linkedin/bio, token or PIN.
   - Output: `signupId`, `queuePosition`.
   - Notes: uses atomic `upsert_event_signup(...)` RPC.

## Queue + Projector Control

1. `queue-reorder`
   - Role: organizer/admin.
   - Input: `eventId`, `orderedSignupIds`.
   - Output: `{ ok: true }`.
   - Notes: delegates to atomic SQL function `reorder_event_queue`.
2. `queue-advance-chunk`
   - Role: organizer/admin.
   - Input: `eventId`, `direction` (`next` or `prev`).
   - Output: normalized `session`.
3. `queue-set-active`
   - Role: organizer/admin.
   - Input: `eventId`, optional `signupId`, optional `timerAction` (`start|pause|reset|next`).
   - Output: normalized `session`.

## Events

1. `event-upsert`
   - Role: organizer/admin.
   - Input create: `chapterId`, `title`, `startsAt`, `endsAt`, optional `venue`, optional `status`.
   - Input update: `eventId` + mutable fields above.
   - Output: `{ event }`.
2. `event-delete`
   - Role: organizer/admin.
   - Input: `eventId`, optional `mode` (`cancel` default, or `hard_delete`).
   - Output: `{ ok: true, mode }`.
3. `public-events`
   - Role: public.
   - Input: optional `limit`.
   - Output: `{ events: [...] }` published upcoming events.

## Networking + Chat

1. `connect-request`
   - Role: chapter member.
   - Input: `chapterId`, `targetUserId`, `type`, optional `eventId`, optional `message`.
   - Output: `{ requestId }`.
2. `connect-respond`
   - Role: request target user.
   - Input: `requestId`, `decision` (`accept` or `decline`).
   - Output: `{ ok: true, conversationId? }`.
3. `message-send`
   - Role: conversation participant.
   - Input: `conversationId`, `body`.
   - Output: `{ messageId }`.
   - Notes: schedules digest notification job for recipient.

## Safety + Moderation + Notifications

1. `report-create`
   - Role: chapter member.
   - Input: `chapterId`, `reportedUserId`, `reason`, optional `context`.
   - Output: `{ reportId }`.
2. `report-resolve`
   - Role: organizer/admin.
   - Input: `reportId`, `status` (`resolved` or `dismissed`), optional `resolutionNote`.
   - Output: `{ ok: true }`.
3. `notification-digest`
   - Role: cron/integration token.
   - Input: none required.
   - Output: processed and delivery counts.
   - Notes: sends via Resend, marks rows `sent` or `failed`, records structured error payload when failed.

