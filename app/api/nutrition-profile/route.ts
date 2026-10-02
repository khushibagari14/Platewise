import { auth } from '@clerk/nextjs/server';
import { database, DatabaseUnavailable } from '@/lib/db';
import { validateProfile } from '@/lib/database-validation';

function failed(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof DatabaseUnavailable
          ? 'Cloud profile is not configured.'
          : 'Could not sync profile. Please try again.',
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
      { profile: await database(userId).profile() },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return failed(error);
  }
}

export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: 'Sign in required.' }, { status: 401 });
  if (request.headers.get('X-Platewise-Account') !== userId)
    return Response.json(
      { error: 'Account changed. Please retry.' },
      { status: 409 },
    );
  const raw = await request.text();
  if (raw.length > 4000)
    return Response.json({ error: 'Profile is too large.' }, { status: 413 });
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'Invalid profile.' }, { status: 400 });
  }
  const profile = validateProfile(value);
  if (!profile)
    return Response.json({ error: 'Invalid profile.' }, { status: 400 });
  try {
    await database(userId).saveProfile(profile);
    return Response.json({ saved: true });
  } catch (error) {
    return failed(error);
  }
}
