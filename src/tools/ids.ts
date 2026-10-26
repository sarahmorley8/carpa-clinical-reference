let counter = 0;

/** Unique id for in-memory items (timers). Not derived from any patient data. */
export function newTimerId(): string {
  counter += 1;
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `t${counter}-${random}`;
}
