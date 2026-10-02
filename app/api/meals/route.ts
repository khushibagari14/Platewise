import { auth } from '@clerk/nextjs/server';
import { database, DatabaseUnavailable } from '@/lib/db';
import { validateMeal } from '@/lib/database-validation';

function failed(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof DatabaseUnavailable
          ? 'Cloud meal history is not configured.'
          : 'Could not sync meals. Please try again.',
    },
    { status: error instanceof DatabaseUnavailable ? 503 : 502 },
  );
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: 'Sign in required.' }, { status: 401 });
  if (request.headers.get('X-Platewise-Account') !== userId)
    return Response.json(
      { error: 'Account changed. Please retry.' },
      { status: 409 },
    );
  try {
    return Response.json(
      { meals: await database(userId).meals() },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return failed(error);
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: 'Sign in required.' }, { status: 401 });
  if (request.headers.get('X-Platewise-Account') !== userId)
    return Response.json(
      { error: 'Account changed. Please retry.' },
      { status: 409 },
    );
  if (Number(request.headers.get('content-length')) > 850_000)
    return Response.json(
      { error: 'Meal image is too large to save.' },
      { status: 413 },
    );
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 850_000)
    return Response.json(
      { error: 'Meal image is too large to save.' },
      { status: 413 },
    );
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'Invalid meal data.' }, { status: 400 });
  }
  const meal = validateMeal(value);
  if (!meal)
    return Response.json({ error: 'Invalid meal data.' }, { status: 400 });
  try {
    await database(userId).saveMeal(meal);
    return Response.json({ saved: true });
  } catch (error) {
    return failed(error);
  }
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: 'Sign in required.' }, { status: 401 });
  if (request.headers.get('X-Platewise-Account') !== userId)
    return Response.json(
      { error: 'Account changed. Please retry.' },
      { status: 409 },
    );
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (
    (!id && url.searchParams.get('all') !== '1') ||
    (id && !/^[a-zA-Z0-9-]{1,80}$/.test(id))
  )
    return Response.json(
      { error: 'A valid meal ID is required.' },
      { status: 400 },
    );
  try {
    await database(userId).deleteMeals(id || undefined);
    return Response.json({ deleted: true });
  } catch (error) {
    return failed(error);
  }
}
