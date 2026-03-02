# Testing And CI

## Test Scripts

Defined in `package.json`:

1. `npm run test:unit`
   - Runs Vitest unit tests.
2. `npm run test:integration`
   - Runs integration contract tests in `tests/integration`.
3. `npm run test:e2e`
   - Runs Playwright end-to-end tests.
4. `npm run test`
   - Sequentially runs unit + integration + e2e.

## Current Test Coverage

1. Unit
   - Graph helpers: positioning and color mapping.
   - Time helper: clamp math.
   - Rate-limit helper: window/retry/remaining-attempt calculations.
2. Integration contract tests
   - Migration contract includes remediation functions/policies.
   - Edge function contract checks for session-join safeguards and atomic signup queue path.
   - Notification digest contract checks Resend integration and failure recording.
3. E2E
   - Landing smoke test confirms agenda heading and upcoming events section.

## CI Pipeline

Workflow: `.github/workflows/ci.yml`

1. Trigger
   - Push to `main`
   - Pull requests
2. Steps
   - `npm ci`
   - `npm run build`
   - `npm run test:unit`
   - `npm run test:integration`
   - Install Playwright browser
   - `npm run test:e2e`

## Local Test Notes

1. E2E requires Playwright browser binaries:
   - `npx playwright install chromium`
2. E2E web server uses local port `4173` from Playwright config.
3. Test artifacts:
   - `test-results/`
   - `playwright-report/`

