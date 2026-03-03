# Remediation Plan 1-13 Status

This document tracks implementation status for the OpenCoffee remediation plan items 1 through 13.

## Status Summary

1. Completed: 13/13 items implemented in code.
2. Additional hardening added:
   - Atomic signup upsert with queue assignment (`upsert_event_signup`) to prevent queue-position collisions under concurrency.

## Item By Item

1. Fix membership escalation in `session-join`
   - Status: Complete.
   - Change: Membership upsert is executed only after token/PIN/session-window validation succeeds.
   - Code: `supabase/functions/session-join/index.ts`

2. Make queue reorder atomic and deterministic
   - Status: Complete.
   - Change: Queue reorder moved to SQL RPC with strict set validation and advisory lock.
   - Code: `public.reorder_event_queue(...)` in `supabase/migrations/20260302120000_remediation_phase1.sql`
   - Caller: `supabase/functions/queue-reorder/index.ts`

3. Enforce block-supersedes-visibility across graph/requests/conversations/messages
   - Status: Complete.
   - Change: Added `public.is_blocked(...)` and updated RLS select/insert/update policies.
   - Code: `supabase/migrations/20260302120000_remediation_phase1.sql`
   - Follow-up hardening: `requests_insert_self`, `requests_update_target_or_organizer`, and `conversations_insert_participant` made block-aware in `20260302130500_phase1_followups.sql`.

4. Enforce self-edit signup only while session open at RLS
   - Status: Complete.
   - Change: `signups_update_self_or_organizer` policy requires open session and active window for self updates.
   - Code: `supabase/migrations/20260302120000_remediation_phase1.sql`

5. Replace digest placeholder with real Resend delivery
   - Status: Complete.
   - Change: `notification-digest` calls Resend API, sets sent/failed state, and stores structured delivery errors.
   - Code: `supabase/functions/notification-digest/index.ts`

6. Add session join attempt rate limiting
   - Status: Complete.
   - Change: Added `session_join_attempts` table + 10-minute rolling window checks in `session-join`.
   - Limits: 10 attempts per user/event/window; 25 attempts per IP/event/window.
   - Code: `supabase/migrations/20260302120000_remediation_phase1.sql`, `supabase/functions/session-join/index.ts`, `supabase/functions/_shared/rateLimit.ts`

7. Make queue position assignment concurrency-safe
   - Status: Complete.
   - Initial implementation: `next_queue_position(...)` helper.
   - Hardening implementation: atomic RPC `upsert_event_signup(...)` with advisory lock and retry handling.
   - Code: `supabase/migrations/20260302130500_phase1_followups.sql`, `supabase/functions/signup-upsert/index.ts`

8. Add audit logs for session open/close
   - Status: Complete.
   - Change: `session-open` and `session-close` insert audit rows.
   - Code: `supabase/functions/session-open/index.ts`, `supabase/functions/session-close/index.ts`

9. Complete events CRUD for organizers/admins
   - Status: Complete.
   - Backend: `event-upsert`, `event-delete` edge functions.
   - Frontend: create/edit/cancel/delete controls in home organizer panel.
   - Code: `supabase/functions/event-upsert/index.ts`, `supabase/functions/event-delete/index.ts`, `src/pages/HomePage.tsx`

10. Add drag/drop queue reorder UX with keyboard support
    - Status: Complete.
    - Change: Implemented using `@dnd-kit` with fallback up/down controls retained.
    - Code: `src/pages/OrganizerEventPage.tsx`, `package.json`

11. Replace SVG graph with canvas renderer targeting 1,500 nodes
    - Status: Complete.
    - Change: `GraphCanvas` migrated to canvas draw loop with click hit testing.
    - Code: `src/components/GraphCanvas.tsx`, `src/lib/graph.ts`

12. Remove Meetup dependency and use OpenCoffee-native events
    - Status: Complete.
    - Change: Landing upcoming events are loaded from Supabase (`public-events`), no hardcoded Meetup event source.
    - Code: `supabase/functions/public-events/index.ts`, `src/pages/LandingPage.tsx`

13. Add automated tests and CI checks
    - Status: Complete.
    - Added unit, integration-contract, and e2e suites plus CI workflow.
    - Code: `tests/*`, `src/lib/*.test.ts`, `.github/workflows/ci.yml`, `package.json`

## Validation Snapshot

1. `npm run build` passed.
2. `npm run test:unit` passed.
3. `npm run test:integration` passed.
4. `npm run test:e2e` passed.

