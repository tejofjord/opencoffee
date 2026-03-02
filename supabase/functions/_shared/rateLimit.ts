export const WINDOW_MS = 10 * 60 * 1000;

export function getWindowStartedAt(nowMs: number): string {
  return new Date(Math.floor(nowMs / WINDOW_MS) * WINDOW_MS).toISOString();
}

export function getRetryAfterSeconds(nowMs: number): number {
  return Math.ceil((WINDOW_MS - (nowMs % WINDOW_MS)) / 1000);
}

export function remainingAttempts(
  userAttempts: number,
  ipAttempts: number,
  userLimit: number,
  ipLimit: number,
): number {
  return Math.max(0, Math.min(userLimit - userAttempts, ipLimit - ipAttempts));
}
