# Neon database

The app stores signed-in users' meal history and nutrition profiles in Neon PostgreSQL. API routes authenticate with Clerk and scope every query to the current Clerk user ID. Anonymous data stays on the device.

For a new environment, run `schema.sql` in that Neon database's SQL Editor, then set the server-only `DATABASE_URL` to its pooled connection string. Locally, use an ignored `.env.development.local`; on Vercel, add `DATABASE_URL` in the project's environment settings and redeploy. Never prefix it with `NEXT_PUBLIC_` or commit the connection string.

Existing device meals are not assigned to an account automatically. A signed-in user can explicitly import them from Meal Calendar.
