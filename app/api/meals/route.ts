import { auth } from '@clerk/nextjs/server';
import { database } from '@/lib/db';
import { validateMeal } from '@/lib/database-validation';

const unavailable = () =>
  Response.json(
    { error: 'Cloud meal history is not configured.' },
    { status: 503 },
  );
const failed = () =>
  Response.json(
    { error: 'Could not sync meals. Please try again.' },
    { status: 502 },
  );

export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: 'Sign in required.' }, { status: 401 });
  const sql = database();
  if (!sql) return unavailable();
  try {
    const rows = await sql`
      SELECT meal FROM platewise_meals
      WHERE clerk_user_id = ${userId}
      ORDER BY created_at DESC LIMIT 180
    `;
    return Response.json({ meals: rows.map((row) => row.meal) });
  } catch {
    return failed();
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: 'Sign in required.' }, { status: 401 });
  const sql = database();
  if (!sql) return unavailable();
  if (Number(request.headers.get('content-length')) > 850_000) {
    return Response.json(
      { error: 'Meal image is too large to save.' },
      { status: 413 },
    );
  }
  try {
    const raw = await request.text();
    if (raw.length > 850_000)
      return Response.json(
        { error: 'Meal image is too large to save.' },
        { status: 413 },
      );
    const meal = validateMeal(JSON.parse(raw));
    if (!meal)
      return Response.json({ error: 'Invalid meal data.' }, { status: 400 });
    const rows = await sql`
      INSERT INTO platewise_meals (id, clerk_user_id, created_at, meal)
      VALUES (${meal.id}, ${userId}, ${meal.createdAt}, ${JSON.stringify(meal)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        meal = EXCLUDED.meal, updated_at = now()
      WHERE platewise_meals.clerk_user_id = ${userId}
      RETURNING id
    `;
    if (!rows.length)
      return Response.json({ error: 'Meal conflict.' }, { status: 409 });
    return Response.json({ saved: true });
  } catch {
    return failed();
  }
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: 'Sign in required.' }, { status: 401 });
  const sql = database();
  if (!sql) return unavailable();
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id && url.searchParams.get('all') !== '1') {
    return Response.json({ error: 'Meal ID required.' }, { status: 400 });
  }
  try {
    if (id) {
      await sql`DELETE FROM platewise_meals WHERE id = ${id} AND clerk_user_id = ${userId}`;
    } else {
      await sql`DELETE FROM platewise_meals WHERE clerk_user_id = ${userId}`;
    }
    return Response.json({ deleted: true });
  } catch {
    return failed();
  }
}
