# Supabase account storage

Clerk remains the login provider. The server verifies Clerk sessions and scopes every database operation to that verified account ID. Supabase stores meals (including thumbnails) and nutrition profiles. Account data loads on login, reconnection, tab focus, and periodic refresh; browser storage is an offline cache and retry queue.

## Configure the existing Vercel project

1. Create or select the Supabase project and run `db/supabase.sql` in its SQL Editor.
2. Enable the Data API for the public schema.
3. Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the existing Vercel project's environment settings. A legacy `SUPABASE_SERVICE_ROLE_KEY` is also supported instead of the secret key. Never expose either private key using a `NEXT_PUBLIC_` variable.
4. Keep the existing Clerk keys so existing logins retain their account IDs.
5. Redeploy the existing Vercel project. Locally, put the same settings in ignored `.env.development.local` and restart the server.

RLS is enabled with browser access revoked. Only authenticated application routes use the private server key. Meal IDs are unique per account, so importing the same browser meal into a different account cannot overwrite someone else's data.

## Existing data

On login, cloud history loads automatically and any legacy meals saved in that browser are imported into the account. Each browser's legacy history belongs to the first account that imports it, so switching accounts does not copy private meals into another account. Existing cloud copies take priority. The app shows import progress and offers a retry after connection errors. Signing in on each browser containing old meals brings that browser's history into the same account.

This switches account persistence from Neon to Supabase. If Neon already contains production data, export and migrate both tables while preserving `clerk_user_id` before switching environments. The original `schema.sql` is retained as the legacy Neon schema; use `supabase.sql` for new Supabase projects.

Simultaneous edits to the same meal/profile use last successful write wins. Offline deletions are replayed before refreshing history. Live Supabase and two-device verification requires your project configuration and Clerk credentials.

Signed-in browser meals missing from Supabase are restored automatically during the first account migration. Cached or guest nutrition details can prefill the form, but must be saved explicitly before being assigned to a login. When browser storage is blocked or full, queues remain in memory and can sync online; keep the tab open until synchronization completes.

Supabase references: [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Data REST API](https://supabase.com/docs/guides/api).
