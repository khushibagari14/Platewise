import 'server-only';
import type { SavedMeal } from '@/lib/nutrition';
import type { NutritionProfile } from '@/lib/database-validation';

export class DatabaseUnavailable extends Error {}

// Only pass an account ID obtained from server-side Clerk auth().
export function database(userId: string) {
  if (!userId) throw new Error('An authenticated account is required.');
  const url = process.env.SUPABASE_URL;
  const secret =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret)
    throw new DatabaseUnavailable('Supabase is not configured.');
  const base = new URL(url);
  if (
    base.protocol !== 'https:' &&
    base.hostname !== 'localhost' &&
    base.hostname !== '127.0.0.1'
  ) {
    throw new DatabaseUnavailable('Supabase requires HTTPS.');
  }

  async function query<T>(
    table: string,
    parameters: Record<string, string>,
    init: RequestInit = {},
  ): Promise<T> {
    const endpoint = new URL(`/rest/v1/${table}`, base);
    endpoint.search = new URLSearchParams({
      ...parameters,
      clerk_user_id: `eq.${userId}`,
    }).toString();
    const headers = new Headers(init.headers);
    headers.set('apikey', secret!);
    // Modern secret keys use apikey; legacy service-role keys are JWTs.
    if (!secret!.startsWith('sb_secret_'))
      headers.set('Authorization', `Bearer ${secret}`);
    headers.set('Content-Type', 'application/json');
    const response = await fetch(endpoint, {
      ...init,
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('Database request failed.');
    const body = await response.text();
    return (body ? JSON.parse(body) : undefined) as T;
  }

  return {
    async meals(): Promise<SavedMeal[]> {
      const meals: SavedMeal[] = [];
      // Read every page so older history is not silently dropped.
      for (let offset = 0; ; offset += 100) {
        const rows = await query<{ meal: SavedMeal }[]>('platewise_meals', {
          select: 'meal',
          order: 'created_at.desc,id.asc',
          limit: '100',
          offset: String(offset),
        });
        meals.push(...rows.map((row) => row.meal));
        if (rows.length < 100) return meals;
      }
    },
    async saveMeal(meal: SavedMeal) {
      await query(
        'platewise_meals',
        { on_conflict: 'clerk_user_id,id' },
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            clerk_user_id: userId,
            id: meal.id,
            created_at: meal.createdAt,
            meal,
            updated_at: new Date().toISOString(),
          }),
        },
      );
    },
    async deleteMeals(id?: string) {
      await query('platewise_meals', id ? { id: `eq.${id}` } : {}, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
    },
    async profile(): Promise<NutritionProfile | null> {
      const rows = await query<{ profile: NutritionProfile }[]>(
        'platewise_nutrition_profiles',
        { select: 'profile', limit: '1' },
      );
      return rows[0]?.profile ?? null;
    },
    async saveProfile(profile: NutritionProfile) {
      await query(
        'platewise_nutrition_profiles',
        { on_conflict: 'clerk_user_id' },
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            clerk_user_id: userId,
            profile,
            updated_at: new Date().toISOString(),
          }),
        },
      );
    },
  };
}
