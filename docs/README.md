# OpenCoffee Documentation

This folder documents the implemented OpenCoffee presenter-to-network application.

## Documents

1. `docs/remediation-plan-1-13.md`
   - Item-by-item status for the remediation plan and where each change lives.
2. `docs/architecture.md`
   - System architecture, trust boundaries, and core runtime flows.
3. `docs/database-and-rls.md`
   - Data model summary, migration inventory, and security policy behavior.
4. `docs/edge-functions.md`
   - Edge function API contracts, request/response shapes, and role requirements.
5. `docs/frontend-flows.md`
   - Route map and UX behavior for attendee, organizer, and post-event networking.
6. `docs/testing-and-ci.md`
   - Test strategy, current suites, and CI execution details.
7. `docs/deployment-runbook.md`
   - Deployment order, smoke checks, and operational checklist.
8. `docs/ops-and-env.md`
   - Environment variables, scheduling, and production operations notes.

## Source Of Truth

1. SQL schema and security:
   - `supabase/migrations/*.sql`
2. Backend application logic:
   - `supabase/functions/*`
3. Frontend application logic:
   - `src/*`
4. Build and test automation:
   - `package.json`, `.github/workflows/ci.yml`

