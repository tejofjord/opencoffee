# Ops And Environment

## Frontend Environment Variables

1. `VITE_SUPABASE_URL`
2. `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Backward-compatible fallback:
   - `VITE_SUPABASE_ANON_KEY`

## Edge Function Environment Variables

1. `SUPABASE_URL`
2. `SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. Optional app URL:
   - `APP_BASE_URL`
5. Digest authorization:
   - `DIGEST_CRON_TOKEN`
6. Resend delivery:
   - `RESEND_API_KEY`
   - `RESEND_FROM` (default: `OpenCoffee <noreply@opencoff.ee>`)

## Email Responsibilities

1. Auth emails
   - Supabase Auth SMTP configuration (magic link).
2. Digest emails
   - `notification-digest` via Resend API.

## Scheduler Operations

1. Trigger `notification-digest` on a fixed cadence (for example hourly).
2. Send `Authorization: Bearer <DIGEST_CRON_TOKEN>` when token is configured.
3. Monitor:
   - `notification_jobs` status distribution (`pending`, `sent`, `failed`)
   - structured `error` payload for failure reason and timestamp.

## Abuse/Safety Monitoring

1. Review `session_join_attempts` growth for attack patterns.
2. Review unresolved reports and moderation backlog.
3. Review audit logs for:
   - session open/close activity
   - queue reorder activity
   - moderation actions

## Known Operational Note

1. Build/test commands may print a warning about a parent workspace `tsconfig` that extends `expo/tsconfig.base`.
2. The warning does not currently block build/test success for this repository.

