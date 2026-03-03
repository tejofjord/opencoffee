# Deployment Runbook

## Release Order

Deploy in this sequence:

1. Database migrations
   - Apply all SQL files in `supabase/migrations` in lexical order.
2. Edge functions
   - Deploy updated/new functions.
3. Frontend
   - Deploy Vite app build.
4. Scheduler and notification config
   - Enable digest scheduler.
   - Configure digest auth token and Resend vars.

## Required Backend Artifacts

1. Tables
   - `session_join_attempts` and `notification_jobs.error` field available.
2. Functions
   - `is_blocked`
   - `reorder_event_queue`
   - `next_queue_position`
   - `upsert_event_signup`
3. Policies
   - Block-aware visibility and write restrictions.
   - Signup self-edit window policy.

## Edge Functions To Deploy

1. session-open
2. session-close
3. session-join
4. signup-upsert
5. queue-reorder
6. queue-advance-chunk
7. queue-set-active
8. event-upsert
9. event-delete
10. public-events
11. connect-request
12. connect-respond
13. message-send
14. report-create
15. report-resolve
16. notification-digest

## Smoke Checklist (Post-Deploy)

1. Auth and session
   - Magic link login succeeds.
2. Event-day flow
   - Organizer opens session and gets token/PIN.
   - Attendee join works with valid token/PIN.
   - Invalid token/PIN increments attempts and eventually throttles.
3. Signup and queue
   - 4 required intro fields enforced.
   - Signup appears in queue with stable position.
   - Reorder persists and projector reflects order.
4. Networking
   - Send request, accept request, conversation opens.
   - Message send succeeds and job is queued.
5. Safety
   - Block hides relevant data and prevents request/chat.
   - Report creation and organizer resolution work.
6. Notifications
   - Digest function marks jobs `sent` on success.
   - Failed delivery marks `failed` with error payload.

## Rollback Considerations

1. Frontend rollback can be independent if DB changes are backward compatible.
2. Function rollback should match current DB function/policy contracts.
3. Do not remove security migrations without replacement; they close known P0/P1 risks.

