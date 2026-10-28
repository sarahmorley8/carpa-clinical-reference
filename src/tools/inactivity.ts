/** Inactivity clear: 60 minutes without interaction, with a 60-second warning (decision D5). */

export const INACTIVITY_LIMIT_MS = 60 * 60 * 1000;
export const INACTIVITY_WARNING_MS = 60 * 1000;

export type InactivityPhase = 'active' | 'warning' | 'expired';

export function inactivityPhase(lastActivity: number, now: number): InactivityPhase {
  const idle = now - lastActivity;
  if (idle >= INACTIVITY_LIMIT_MS) return 'expired';
  if (idle >= INACTIVITY_LIMIT_MS - INACTIVITY_WARNING_MS) return 'warning';
  return 'active';
}

export function secondsUntilClear(lastActivity: number, now: number): number {
  return Math.max(0, Math.ceil((lastActivity + INACTIVITY_LIMIT_MS - now) / 1000));
}
