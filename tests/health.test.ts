// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { GET } from '@/app/api/health/route';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('checks connectivity without returning account data or secrets', async () => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_private');
  const fetcher = vi.fn().mockResolvedValue(Response.json([])); vi.stubGlobal('fetch', fetcher);
  const response = await GET();
  expect(await response.json()).toEqual({storageReady: true});
  expect(fetcher.mock.calls[0][0].searchParams.get('limit')).toBe('0');
});
it('reports missing runtime configuration without querying the database', async () => {
  vi.stubEnv('SUPABASE_URL', ''); vi.stubEnv('SUPABASE_SECRET_KEY', ''); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const response = await GET();
  expect(response.status).toBe(503); expect(await response.json()).toEqual({storageReady:false, reason:'not_configured'});
  expect(fetcher).not.toHaveBeenCalled();
});
