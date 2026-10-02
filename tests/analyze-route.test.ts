// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'scan_user' }),
}));
import { POST } from '@/app/api/analyze-meal/route';
beforeEach(() => vi.stubEnv('GEMINI_API_KEY', 'test_key'));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function request() {
  const body = new FormData();
  body.append(
    'images',
    new File(['photo'], 'meal.jpg', { type: 'image/jpeg' }),
  );
  return new Request('http://localhost/api/analyze-meal', {
    method: 'POST',
    headers: {
      'X-Platewise-Account': 'scan_user',
      'x-forwarded-for': crypto.randomUUID(),
    },
    body,
  });
}
it('reports missing configuration without contacting the provider', async () => {
  vi.stubEnv('GEMINI_API_KEY', '');
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(((await response.json()) as { error: string }).error).toContain(
    'not configured',
  );
  expect(fetcher).not.toHaveBeenCalled();
});
it('reports rejected credentials without retrying', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({}, { status: 403 }));
  vi.stubGlobal('fetch', fetcher);
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(((await response.json()) as { error: string }).error).toContain(
    'configuration update',
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('falls back when a configured model is unavailable and returns the meal', async () => {
  const meal = {
    title: 'Lunch',
    items: [
      {
        name: 'Rice',
        portion: 'One bowl',
        calories: 200,
        protein: 4,
        carbs: 44,
        fat: 1,
        fiber: 1,
      },
    ],
    confidence: 'medium',
    notes: [],
  };
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({}, { status: 404 }))
    .mockResolvedValueOnce(
      Response.json({
        candidates: [{ content: { parts: [{ text: JSON.stringify(meal) }] } }],
      }),
    );
  vi.stubGlobal('fetch', fetcher);
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(
    ((await response.json()) as { items: { name: string }[] }).items[0].name,
  ).toBe('Rice');
  expect(fetcher).toHaveBeenCalledTimes(2);
});
