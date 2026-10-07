import { readQueue, writeQueue } from '@/lib/sync-storage';
import type { SavedMeal } from '@/lib/nutrition';
import { syncResponseError } from '@/lib/sync-error';
import { validateMeal } from '@/lib/database-validation';

type Operation =
  | { type: 'save'; meal: SavedMeal }
  | { type: 'delete'; id: string }
  | { type: 'clear' };

const key = (userId: string) => `platewise:meal-sync:${userId}`;
const pending = new Map<string, Promise<void>>();

function read(userId: string): Operation[] {
  try {
    const value = JSON.parse(readQueue(key(userId)) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function queueMealOperation(userId: string, operation: Operation) {
  const operations = read(userId);
  operations.push(operation);
  writeQueue(key(userId), JSON.stringify(operations));
}

export function withPendingMeals(
  userId: string,
  meals: SavedMeal[],
): SavedMeal[] {
  const merged = new Map(meals.map((meal) => [meal.id, meal]));
  for (const operation of read(userId)) {
    if (operation.type === 'clear') merged.clear();
    else if (operation.type === 'delete') merged.delete(operation.id);
    else {
      const meal = validateMeal(operation.meal);
      if (meal) merged.set(meal.id, meal);
    }
  }
  return [...merged.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function flushMealOperations(userId: string): Promise<void> {
  const running = pending.get(userId);
  if (running) return running;
  const taskBody = async () => {
    while (read(userId).length) {
      const operation = read(userId)[0];
      const response = await fetch(
        operation.type === 'delete'
          ? `/api/meals?id=${encodeURIComponent(operation.id)}`
          : operation.type === 'clear'
            ? '/api/meals?all=1'
            : '/api/meals',
        operation.type === 'save'
          ? {
              method: 'POST',
              signal: AbortSignal.timeout(20_000),
              headers: {
                'Content-Type': 'application/json',
                'X-Platewise-Account': userId,
              },
              body: JSON.stringify(operation.meal),
            }
          : {
              method: 'DELETE',
              headers: { 'X-Platewise-Account': userId },
              signal: AbortSignal.timeout(20_000),
            },
      );
      if (!response.ok)
        throw await syncResponseError(response, 'Meal sync failed.');
      const remaining = read(userId);
      remaining.shift();
      writeQueue(key(userId), JSON.stringify(remaining));
    }
  };
  const task = (async () => {
    if (navigator.locks) await navigator.locks.request(key(userId), taskBody);
    else await taskBody();
  })();
  pending.set(userId, task);
  void task.finally(() => pending.delete(userId)).catch(() => undefined);
  return task;
}
