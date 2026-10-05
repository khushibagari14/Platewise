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

it('estimates a typed meal without requiring an image', async () => {
  const generated = {
    title: 'Bread and curd',
    items: [
      {
        name: 'Curd',
        portion: '100 g',
        calories: 80,
        protein: 4,
        carbs: 5,
        fat: 3,
        fiber: 0,
      },
    ],
    confidence: 'medium',
    notes: ['Portions estimated.'],
  };
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      candidates: [
        { content: { parts: [{ text: JSON.stringify(generated) }] } },
      ],
    }),
  );
  vi.stubGlobal('fetch', fetcher);
  const form = new FormData();
  form.append('description', '2 slices of bread and 100 g curd');
  const response = await POST(
    new Request('http://localhost/api/analyze-meal', {
      method: 'POST',
      body: form,
      headers: {
        'X-Platewise-Account': 'scan_user',
        'x-forwarded-for': crypto.randomUUID(),
      },
    }),
  );
  expect(response.status).toBe(200);
  const sent = JSON.parse(fetcher.mock.calls[0][1].body as string) as {
    contents: { parts: { text: string }[] }[];
    systemInstruction: { parts: { text: string }[] };
  };
  expect(sent.systemInstruction.parts[0].text).toContain('near the lower end');
  expect(sent.systemInstruction.parts[0].text).toContain('do not reduce known values arbitrarily');
  expect(sent.contents[0].parts).toHaveLength(1);
  expect(sent.contents[0].parts[0].text).toContain('2 slices of bread');
});
it('rejects overlong manual descriptions before provider calls', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const form = new FormData();
  form.append('description', 'a'.repeat(1001));
  const response = await POST(
    new Request('http://localhost/api/analyze-meal', {
      method: 'POST',
      body: form,
      headers: {
        'X-Platewise-Account': 'scan_user',
        'x-forwarded-for': crypto.randomUUID(),
      },
    }),
  );
  expect(response.status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});

it('passes optional photo details alongside the image to the model', async () => {
  const generated = {
    title: 'Banana shake',
    items: [
      {
        name: 'Banana shake',
        portion: '250 ml',
        calories: 200,
        protein: 6,
        carbs: 35,
        fat: 4,
        fiber: 2,
      },
    ],
    confidence: 'medium',
    notes: [],
  };
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        candidates: [
          { content: { parts: [{ text: JSON.stringify(generated) }] } },
        ],
      }),
    );
  vi.stubGlobal('fetch', fetcher);
  const form = new FormData();
  form.append(
    'images',
    new File(['photo'], 'shake.jpg', { type: 'image/jpeg' }),
  );
  form.append('photoContext', 'Banana shake with milk, no added sugar');
  const response = await POST(
    new Request('http://localhost/api/analyze-meal', {
      method: 'POST',
      body: form,
      headers: {
        'X-Platewise-Account': 'scan_user',
        'x-forwarded-for': crypto.randomUUID(),
      },
    }),
  );
  expect(response.status).toBe(200);
  const sent = JSON.parse(fetcher.mock.calls[0][1].body as string) as {
    contents: { parts: { text?: string; inline_data?: unknown }[] }[];
    systemInstruction: { parts: { text: string }[] };
  };
  expect(sent.systemInstruction.parts[0].text).toContain('near the lower end');
  expect(sent.systemInstruction.parts[0].text).toContain('not exact measurements');
  expect(sent.systemInstruction.parts[0].text).toContain('Estimate portions before calculating any nutrients');
  expect(sent.systemInstruction.parts[0].text).toContain('lower bound supported by the evidence');
  expect(sent.systemInstruction.parts[0].text).toContain('do not apply dry legume or raw-food values');
  expect(sent.systemInstruction.parts[0].text).toContain('not a calibrated size reference');
  expect(sent.contents[0].parts[0].text).toContain(
    'Banana shake with milk, no added sugar',
  );
  expect(sent.contents[0].parts[1].inline_data).toBeTruthy();
});
it('rejects oversized optional photo details', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const form = new FormData();
  form.append(
    'images',
    new File(['photo'], 'shake.jpg', { type: 'image/jpeg' }),
  );
  form.append('photoContext', 'a'.repeat(501));
  const response = await POST(
    new Request('http://localhost/api/analyze-meal', {
      method: 'POST',
      body: form,
      headers: {
        'X-Platewise-Account': 'scan_user',
        'x-forwarded-for': crypto.randomUUID(),
      },
    }),
  );
  expect(response.status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});

it('tries a fallback before retrying an overloaded model', async () => {
 const generated = { title: 'Curd', confidence: 'medium', notes: [], items: [{ name: 'Curd', portion: '100 g', calories: 60, protein: 3.5, carbs: 4, fat: 3, fiber: 0 }] };
 const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ error: { status: 'UNAVAILABLE' } }, { status: 503 })).mockResolvedValueOnce(Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] } }] }));
 vi.stubGlobal('fetch', fetcher);
 expect((await POST(request())).status).toBe(200);
 expect(fetcher).toHaveBeenCalledTimes(2);
 expect(fetcher.mock.calls[0][0]).not.toBe(fetcher.mock.calls[1][0]);
 expect(JSON.parse(fetcher.mock.calls[0][1].body).generationConfig.thinkingConfig.thinkingLevel).toBe('low');
});
it('falls back when response headers arrive but reading the body fails', async () => {
 const generated = { title: 'Curd', confidence: 'medium', notes: [], items: [{ name: 'Curd', portion: '100 g', calories: 60, protein: 3.5, carbs: 4, fat: 3, fiber: 0 }] };
 const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.reject(new DOMException('Timed out', 'AbortError')) }).mockResolvedValueOnce(Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(generated) }] } }] }));
 vi.stubGlobal('fetch', fetcher);
 expect((await POST(request())).status).toBe(200);
 expect(fetcher).toHaveBeenCalledTimes(2);
});
