import { auth } from '@clerk/nextjs/server';
import { database } from '@/lib/db';
import { validateProfile } from '@/lib/database-validation';

export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: 'Sign in required.' }, { status: 401 });
  const sql = database();
  if (!sql)
    return Response.json(
      { error: 'Cloud profile is not configured.' },
      { status: 503 },
    );
  try {
    const rows = await sql`
      SELECT profile FROM platewise_nutrition_profiles
      WHERE clerk_user_id = ${userId} LIMIT 1
    `;
    return Response.json({ profile: rows[0]?.profile || null });
  } catch {
    return Response.json({ error: 'Could not load profile.' }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId)
    return Response.json({ error: 'Sign in required.' }, { status: 401 });
  const sql = database();
  if (!sql)
    return Response.json(
      { error: 'Cloud profile is not configured.' },
      { status: 503 },
    );
  try {
    const profile = validateProfile(await request.json());
    if (!profile)
      return Response.json({ error: 'Invalid profile.' }, { status: 400 });
    await sql`
      INSERT INTO platewise_nutrition_profiles (clerk_user_id, profile)
      VALUES (${userId}, ${JSON.stringify(profile)}::jsonb)
      ON CONFLICT (clerk_user_id) DO UPDATE SET
        profile = EXCLUDED.profile, updated_at = now()
    `;
    return Response.json({ saved: true });
  } catch {
    return Response.json({ error: 'Could not save profile.' }, { status: 502 });
  }
}
