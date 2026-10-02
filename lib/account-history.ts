import { validateMeal } from '@/lib/database-validation';
import { flushMealOperations, queueMealOperation } from '@/lib/meal-sync';
import type { SavedMeal } from '@/lib/nutrition';

export const HISTORY_KEY = 'platewise:recent-meals';
const CLAIM_KEY = 'platewise:browser-history-owner';
const pending = new Map<
  string,
  Promise<{ meals: SavedMeal[]; imported: number }>
>();
export const accountHistoryKey = (userId?: string | null) =>
  userId ? `${HISTORY_KEY}:${userId}` : HISTORY_KEY;
export function storedValue(key: string) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}
export function readMeals(key: string): SavedMeal[] {
  try {
    const value: unknown = JSON.parse(storedValue(key) || '[]');
    return Array.isArray(value)
      ? value
          .map(validateMeal)
          .filter((meal): meal is SavedMeal => meal !== null)
      : [];
  } catch {
    return [];
  }
}
async function load(userId: string) {
  const response = await fetch('/api/meals', {
    cache: 'no-store',
    headers: { 'X-Platewise-Account': userId },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error('History is unavailable.');
  const body = (await response.json()) as { meals?: unknown };
  if (!Array.isArray(body.meals)) throw new Error('Invalid history response.');
  return body.meals
    .map(validateMeal)
    .filter((meal): meal is SavedMeal => meal !== null);
}

// Account caches migrate once, so a meal deleted on another device is never
// resurrected on every login. Unscoped browser meals belong to the first login
// that claims them; later logins cannot copy a previous account's history.
export function restoreAccountHistory(userId: string) {
  const running = pending.get(userId);
  if (running) return running;
  async function restore() {
    await flushMealOperations(userId);
    let meals = await load(userId);
    const migratedKey = `platewise:account-history-migrated:${userId}`;
    const guestDoneKey = `platewise:legacy-imported:${userId}`;
    let owner = storedValue(CLAIM_KEY);
    if (!owner) {
      try {
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index);
          if (key?.startsWith('platewise:legacy-imported:') && storedValue(key) === '1') {
            owner = key.slice('platewise:legacy-imported:'.length);
            localStorage.setItem(CLAIM_KEY, owner);
            break;
          }
        }
      } catch {}
    }
    const guest =
      !storedValue(guestDoneKey) && (!owner || owner === userId)
        ? readMeals(HISTORY_KEY)
        : [];
    const cached = storedValue(migratedKey)
      ? []
      : [
          ...readMeals(accountHistoryKey(userId)),
          ...readMeals(`platewise:recovered-meals:${userId}`),
        ];
    const existing = new Set(meals.map((meal) => meal.id));
    const candidates = [
      ...new Map(
        [...guest, ...cached]
          .filter((meal) => !existing.has(meal.id))
          .map((meal) => [meal.id, meal]),
      ).values(),
    ];
    // Persist the owner before sending, including when a network failure occurs.
    // If this fails, retain browser history and retry rather than risk reassignment.
    if (guest.length && !owner) localStorage.setItem(CLAIM_KEY, userId);
    for (const meal of candidates)
      queueMealOperation(userId, { type: 'save', meal });
    await flushMealOperations(userId);
    if (candidates.length) meals = await load(userId);
    try {
      localStorage.setItem(migratedKey, '1');
      if (guest.length || owner === userId) localStorage.setItem(guestDoneKey, '1');
      localStorage.removeItem(`platewise:recovered-meals:${userId}`);
    } catch {}
    return { meals, imported: candidates.length };
  }
  const task = (async () => {
    // Serialize claims between tabs, including tabs logged into different users.
    return navigator.locks
      ? await navigator.locks.request('platewise:restore-history', restore)
      : await restore();
  })();
  pending.set(userId, task);
  void task.finally(() => pending.delete(userId)).catch(() => undefined);
  return task;
}
