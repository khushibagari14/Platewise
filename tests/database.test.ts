// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const session = vi.hoisted(() => ({ userId: 'user_a' as string | null }));
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => session }));
import { database, DatabaseUnavailable } from '@/lib/db';
import { GET, POST, DELETE } from '@/app/api/meals/route';
import { PUT } from '@/app/api/nutrition-profile/route';
import { POST as analyze } from '@/app/api/analyze-meal/route';
import { meal, profile } from './fixtures';

beforeEach(() => {
  session.userId = 'user_a';
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const request = (
  url: string,
  method = 'GET',
  body?: unknown,
  account = 'user_a',
) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: {
      'X-Platewise-Account': account,
      'Content-Type': 'application/json',
    },
    ...(method !== 'GET' && body !== undefined
      ? { body: JSON.stringify(body) }
      : {}),
  });

describe('server account storage', () => {
  it('denies anonymous access before querying Supabase or Gemini', async () => {
    session.userId = null;
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect((await GET(request('/api/meals'))).status).toBe(401);
    expect((await POST(request('/api/meals', 'POST', meal))).status).toBe(401);
    expect((await DELETE(request('/api/meals?all=1', 'DELETE'))).status).toBe(
      401,
    );
    expect(
      (await PUT(request('/api/nutrition-profile', 'PUT', profile))).status,
    ).toBe(401);
    expect((await analyze(request('/api/analyze-meal', 'POST'))).status).toBe(
      401,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects queued changes from another login', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(
      (await POST(request('/api/meals', 'POST', meal, 'user_b'))).status,
    ).toBe(409);
    expect(
      (await DELETE(request('/api/meals?all=1', 'DELETE', undefined, 'user_b')))
        .status,
    ).toBe(409);
    expect(
      (await PUT(request('/api/nutrition-profile', 'PUT', profile, 'user_b')))
        .status,
    ).toBe(409);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses the verified identity, ignores forged body identities, and handles empty insert responses', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetcher);
    expect(
      (
        await POST(
          request('/api/meals', 'POST', { ...meal, clerk_user_id: 'user_b' }),
        )
      ).status,
    ).toBe(200);
    const [url, options] = fetcher.mock.calls[0];
    expect(new URL(url).searchParams.get('clerk_user_id')).toBe('eq.user_a');
    expect(new URL(url).searchParams.get('on_conflict')).toBe(
      'clerk_user_id,id',
    );
    expect(JSON.parse(options.body).clerk_user_id).toBe('user_a');
    expect(options.headers.get('apikey')).toBe('sb_secret_test');
    expect(options.headers.has('Authorization')).toBe(false);
  });
  it('scopes single deletes and clear-all to the signed-in account', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    await database('user_a').deleteMeals('meal-1');
    await database('user_a').deleteMeals();
    for (const [url] of fetcher.mock.calls)
      expect(new URL(url).searchParams.get('clerk_user_id')).toBe('eq.user_a');
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('id')).toBe(
      'eq.meal-1',
    );
  });
  it('loads history beyond one response page', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(Array.from({ length: 100 }, () => ({ meal }))),
      )
      .mockResolvedValueOnce(
        Response.json([{ meal: { ...meal, id: 'old-meal' } }]),
      );
    vi.stubGlobal('fetch', fetcher);
    const meals = await database('user_a').meals();
    expect(meals).toHaveLength(101);
    expect(meals[100].id).toBe('old-meal');
    expect(new URL(fetcher.mock.calls[1][0]).searchParams.get('offset')).toBe(
      '100',
    );
  });
  it('reports missing configuration and upstream failures without leaking secrets', async () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(() => database('user_a')).toThrow(DatabaseUnavailable);
    expect((await GET(request('/api/meals'))).status).toBe(503);
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('secret diagnostic', { status: 500 })),
    );
    const result = await GET(request('/api/meals'));
    expect(result.status).toBe(502);
    expect(await result.text()).not.toContain('secret diagnostic');
  });
  it('returns bad input as 400 rather than a database outage', async () => {
    vi.stubGlobal('fetch', vi.fn());
    expect(
      (
        await POST(
          request('/api/meals', 'POST', {
            ...meal,
            thumbnail: 'https://untrusted.example',
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await PUT(
          request('/api/nutrition-profile', 'PUT', { ...profile, age: -1 }),
        )
      ).status,
    ).toBe(400);
    const malformed = new Request('http://localhost/api/meals', {
      method: 'POST',
      headers: { 'X-Platewise-Account': 'user_a' },
      body: '{',
    });
    expect((await POST(malformed)).status).toBe(400);
  });
});
