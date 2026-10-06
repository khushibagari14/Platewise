import { afterEach, expect, it, vi } from 'vitest';
import { AnalysisError, requestMealAnalysis } from '@/lib/analyze-client';
afterEach(() => vi.unstubAllGlobals());
it('handles a non-JSON hosting error without losing the draft or showing JSON parse errors', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('Gateway error', { status: 502 })),
  );
  await expect(requestMealAnalysis(new FormData(), 'user')).rejects.toThrow(
    'Your meal details are kept',
  );
});
it('preserves the no-food error code for replacing rejected photos', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { code: 'food_not_detected', error: 'No food' },
          { status: 422 },
        ),
      ),
  );
  await expect(
    requestMealAnalysis(new FormData(), 'user'),
  ).rejects.toMatchObject({ code: 'food_not_detected' });
});
it('turns network failures into a helpful retry message', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  );
  await expect(requestMealAnalysis(new FormData(), 'user')).rejects.toThrow(
    'check your connection',
  );
});
it('turns request timeouts into a helpful retry message', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new DOMException('Timeout', 'TimeoutError')),
  );
  await expect(requestMealAnalysis(new FormData(), 'user')).rejects.toThrow(
    'took too long',
  );
});
it('rejects an empty successful response without saving a broken meal', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ items: [] })),
  );
  await expect(
    requestMealAnalysis(new FormData(), 'user'),
  ).rejects.toBeInstanceOf(AnalysisError);
});
