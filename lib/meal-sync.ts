import type { SavedMeal } from '@/lib/nutrition';

type Operation =
  | { type: 'save'; meal: SavedMeal }
  | { type: 'delete'; id: string }
  | { type: 'clear' };

const key = (userId: string) => `platewise:meal-sync:${userId}`;
const pending = new Map<string, Promise<void>>();

function read(userId: string): Operation[] {
  try {
    const value = JSON.parse(localStorage.getItem(key(userId)) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function queueMealOperation(userId: string, operation: Operation) {
  const operations = read(userId);
  operations.push(operation);
  localStorage.setItem(key(userId), JSON.stringify(operations));
}

export function flushMealOperations(userId: string): Promise<void> {
  const running = pending.get(userId);
  if (running) return running;
  const task = (async () => {
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
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(operation.meal),
            }
          : { method: 'DELETE' },
      );
      if (!response.ok) throw new Error('Meal sync failed.');
      const remaining = read(userId);
      remaining.shift();
      localStorage.setItem(key(userId), JSON.stringify(remaining));
    }
  })();
  pending.set(userId, task);
  void task.finally(() => pending.delete(userId)).catch(() => undefined);
  return task;
}
