# OpenCoffee Presenter-to-Network App

React + TypeScript frontend with Supabase backend for event intros, live organizer queue, and post-event networking.

## Documentation

- Full project documentation is in `docs/README.md`.

## Stack

- Frontend: Vite, React, TypeScript, Supabase JS, React Router
- Backend: Supabase Postgres + RLS + Edge Functions

## Local setup

1. Install dependencies:
   - `npm install`
2. Configure env:
   - Copy `.env.example` to `.env`
   - Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Run frontend:
   - `npm run dev`
4. Run tests:
   - `npm run test:unit`
   - `npm run test:integration`
   - `npm run test:e2e`

## Supabase setup

1. Create a Supabase project.
2. Apply SQL migrations in `supabase/migrations/*.sql` in order.
3. Run `supabase/seed.sql` to create Oslo chapter bootstrap data.
4. Deploy edge functions from `supabase/functions/*`.
5. Set edge function env vars:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - optional: `APP_BASE_URL`
   - `RESEND_API_KEY` (for digest emails)
   - optional: `RESEND_FROM` (default `OpenCoffee <noreply@opencoff.ee>`)
   - optional: `DIGEST_CRON_TOKEN`

## Implemented routes

- `/`
- `/auth`
- `/app`
- `/app/events/:eventId/join`
- `/app/organizer/events/:eventId`
- `/app/network`
- `/app/inbox`
- `/app/moderation`

## Implemented edge functions

- `session-open`
- `session-close`
- `session-join`
- `signup-upsert`
- `queue-reorder`
- `queue-advance-chunk`
- `queue-set-active`
- `connect-request`
- `connect-respond`
- `message-send`
- `report-create`
- `report-resolve`
- `event-upsert`
- `event-delete`
- `public-events`
- `notification-digest` (scheduled digest dispatcher)

## TODO

- Configure Resend domain verification (DNS) for `opencoff.ee` and enable production digest scheduler.
