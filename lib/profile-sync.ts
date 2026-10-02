import { readQueue, writeQueue, removeQueue } from '@/lib/sync-storage';
import type { NutritionProfile } from '@/lib/database-validation';

const key = (userId: string) => `platewise:profile-sync:${userId}`;
const pending = new Map<string, Promise<void>>();

export function queueProfile(userId: string, profile: NutritionProfile) {
  writeQueue(key(userId), JSON.stringify({ id: crypto.randomUUID(), profile }));
}

export function flushProfile(userId: string): Promise<void> {
  const running = pending.get(userId);
  if (running) return running;
  async function send() {
    for (;;) {
      const snapshot = readQueue(key(userId));
      if (!snapshot) return;
      const operation = JSON.parse(snapshot) as { profile: NutritionProfile };
      const response = await fetch('/api/nutrition-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Platewise-Account': userId,
        },
        body: JSON.stringify(operation.profile),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error('Profile sync failed.');
      // An edit made while this request was in flight must not be discarded.
      if (readQueue(key(userId)) === snapshot) removeQueue(key(userId));
    }
  }
  const task = (async () => {
    if (navigator.locks) await navigator.locks.request(key(userId), send);
    else await send();
  })();
  pending.set(userId, task);
  void task.finally(() => pending.delete(userId)).catch(() => undefined);
  return task;
}
