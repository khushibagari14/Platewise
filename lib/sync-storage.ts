// Some browsers deny storage or exhaust their quota. Keep an in-memory queue
// so online saving still works; callers must not promise persistence on reload.
const volatile = new Map<string, string>();
export function readQueue(key: string): string | null {
  if (volatile.has(key)) return volatile.get(key)!;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writeQueue(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    volatile.delete(key);
  } catch {
    volatile.set(key, value);
  }
}
export function removeQueue(key: string) {
  volatile.delete(key);
  try {
    localStorage.removeItem(key);
  } catch {}
}
