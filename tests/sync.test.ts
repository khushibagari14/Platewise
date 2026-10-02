import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { flushMealOperations, queueMealOperation } from '@/lib/meal-sync';
import { flushProfile, queueProfile } from '@/lib/profile-sync';
import { meal, profile } from './fixtures';

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('offline meal queue', () => {
  it('retains failed changes, retries in order, and identifies their account', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    queueMealOperation('user_a', { type: 'save', meal });
    queueMealOperation('user_a', { type: 'delete', id: meal.id });
    await expect(flushMealOperations('user_a')).rejects.toThrow();
    expect(
      JSON.parse(localStorage.getItem('platewise:meal-sync:user_a')!),
    ).toHaveLength(2);
    await flushMealOperations('user_a');
    expect(fetcher.mock.calls.map((call) => call[1].method)).toEqual([
      'POST',
      'POST',
      'DELETE',
    ]);
    expect(fetcher.mock.calls[2][1].headers['X-Platewise-Account']).toBe(
      'user_a',
    );
    expect(
      JSON.parse(localStorage.getItem('platewise:meal-sync:user_a')!),
    ).toHaveLength(0);
  });
  it('keeps changes appended during a request and shares concurrent flushes', async () => {
    let finish!: (response: Response) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    queueMealOperation('user_a', { type: 'save', meal });
    const running = flushMealOperations('user_a');
    expect(flushMealOperations('user_a')).toBe(running);
    queueMealOperation('user_a', { type: 'clear' });
    finish(new Response(null, { status: 204 }));
    await running;
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toBe('/api/meals?all=1');
  });
  it('keeps separate account queues', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    queueMealOperation('user_a', { type: 'save', meal });
    queueMealOperation('user_b', { type: 'clear' });
    await flushMealOperations('user_a');
    expect(
      JSON.parse(localStorage.getItem('platewise:meal-sync:user_b')!),
    ).toHaveLength(1);
  });
});

describe('profile retries', () => {
  it('preserves a failed save across reloads until a successful retry', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    queueProfile('user_a', profile);
    await expect(flushProfile('user_a')).rejects.toThrow();
    expect(
      localStorage.getItem('platewise:profile-sync:user_a'),
    ).not.toBeNull();
    await flushProfile('user_a');
    expect(localStorage.getItem('platewise:profile-sync:user_a')).toBeNull();
    expect(fetcher.mock.calls[0][1].headers['X-Platewise-Account']).toBe(
      'user_a',
    );
  });
  it('does not discard a newer edit when an older save completes', async () => {
    let finish!: (response: Response) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    queueProfile('user_a', profile);
    const running = flushProfile('user_a');
    queueProfile('user_a', { ...profile, weight: 65 });
    finish(new Response(null, { status: 204 }));
    await running;
    expect(JSON.parse(fetcher.mock.calls[1][1].body).weight).toBe(65);
  });
});
