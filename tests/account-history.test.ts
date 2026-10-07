import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import {
  restoreAccountHistory,
  HISTORY_KEY,
  accountHistoryKey,
} from '@/lib/account-history';
import { meal } from './fixtures';
import { queueMealOperation } from '@/lib/meal-sync';
beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());
function server(initial = [meal]) {
  const rows = new Map(initial.map((item) => [item.id, item]));
  const fetcher = vi
    .fn()
    .mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        if (typeof init.body !== 'string')
          throw new Error('Expected a JSON request body');
        const entry = JSON.parse(init.body);
        rows.set(entry.id, entry);
        return new Response(null, { status: 204 });
      }
      return Response.json({ meals: [...rows.values()] });
    });
  vi.stubGlobal('fetch', fetcher);
  return { fetcher, rows };
}
it('automatically merges browser and account meals without overwriting cloud copies', async () => {
  const { fetcher } = server();
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify([
      { ...meal, title: 'Old local copy' },
      { ...meal, id: 'guest-meal', title: 'Browser lunch' },
    ]),
  );
  localStorage.setItem(
    accountHistoryKey('user_a'),
    JSON.stringify([{ ...meal, id: 'cached-meal' }]),
  );
  const result = await restoreAccountHistory('user_a');
  expect(result.imported).toBe(2);
  expect(result.meals).toHaveLength(3);
  expect(result.meals.find((item) => item.id === meal.id)?.title).toBe('Lunch');
  expect(localStorage.getItem('platewise:browser-history-owner')).toBe(
    'user_a',
  );
  expect(
    fetcher.mock.calls.filter((call) => call[1]?.method === 'POST'),
  ).toHaveLength(2);
});
it('does not restore remotely deleted meals from an old browser cache on later logins', async () => {
  const { rows, fetcher } = server();
  localStorage.setItem(accountHistoryKey('user_a'), JSON.stringify([meal]));
  await restoreAccountHistory('user_a');
  rows.clear();
  const result = await restoreAccountHistory('user_a');
  expect(result.meals).toHaveLength(0);
  expect(fetcher.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(
    false,
  );
});
it('does not copy claimed browser history into another account', async () => {
  const { fetcher } = server([]);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([meal]));
  localStorage.setItem('platewise:browser-history-owner', 'user_a');
  const result = await restoreAccountHistory('user_b');
  expect(result.imported).toBe(0);
  expect(fetcher.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(
    false,
  );
});
it('honors previous explicit imports when upgrading the flow', async () => {
  const { fetcher } = server([]);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([meal]));
  localStorage.setItem('platewise:legacy-imported:user_a', '1');
  await restoreAccountHistory('user_b');
  expect(fetcher.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(
    false,
  );
});
it('retains failed imports for retry and marks completion only after success', async () => {
  const { fetcher } = server([]);
  let fail = true;
  fetcher.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST')
      return new Response(null, { status: fail ? 503 : 204 });
    return Response.json({ meals: fail ? [] : [meal] });
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify([meal]));
  await expect(restoreAccountHistory('user_a')).rejects.toThrow();
  expect(localStorage.getItem('platewise:legacy-imported:user_a')).toBeNull();
  expect(localStorage.getItem(HISTORY_KEY)).not.toBeNull();
  expect(localStorage.getItem('platewise:browser-history-owner')).toBe(
    'user_a',
  );
  fail = false;
  const result = await restoreAccountHistory('user_a');
  expect(result.meals).toHaveLength(1);
  expect(localStorage.getItem('platewise:legacy-imported:user_a')).toBe('1');
});

it('does not accept an invalid cloud record as an empty history or replace the cache', async () => {
  const cached = JSON.stringify([meal]);
  localStorage.setItem(accountHistoryKey('validation_user'), cached);
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ meals: [{ ...meal, items: 'invalid' }] }),
      ),
  );
  await expect(restoreAccountHistory('validation_user')).rejects.toThrow(
    'could not be loaded',
  );
  expect(localStorage.getItem(accountHistoryKey('validation_user'))).toBe(
    cached,
  );
  expect(
    localStorage.getItem('platewise:account-history-migrated:validation_user'),
  ).toBeNull();
});

it('still loads saved cloud meals when one pending upload fails', async () => {
  queueMealOperation('pending_user', {
    type: 'save',
    meal: { ...meal, id: 'unsynced' },
  });
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation((_url, init) =>
        init?.method === 'POST'
          ? Response.json(
              { error: 'Save temporarily unavailable' },
              { status: 503 },
            )
          : Response.json({ meals: [meal] }),
      ),
  );
  const result = await restoreAccountHistory('pending_user');
  expect(result.meals.map((m) => m.id)).toContain(meal.id);
  expect(result.meals.map((m) => m.id)).toContain('unsynced');
  expect(result.syncError).toBe('Save temporarily unavailable');
  expect(localStorage.getItem('platewise:meal-sync:pending_user')).toContain(
    'unsynced',
  );
});
