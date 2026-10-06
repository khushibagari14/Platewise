# Meal analysis configuration

Set these server-only variables in the ignored `.env.development.local` for local work and in Vercel → Platewise → Settings → Environment Variables → Production for the deployed app:

- `GEMINI_API_KEY`: primary Gemini API key.
- `GEMINI_API_KEY_FALLBACK`: optional backup key. The app tries it automatically after primary failures; it also works when no primary key is configured.
- `GEMINI_MODEL`: optional primary model override; defaults to `gemini-3.6-flash`.

Redeploy after changing Production variables. Never put keys in Git, chat, or a `NEXT_PUBLIC_` variable. Local environment files do not update Vercel.

The app tries Flash-Lite and other Flash models on unavailable or quota-limited models, observes Gemini retry delays, and gives each configured key time within the request deadline. Manual descriptions and photos use the same failover path. Incomplete responses are retried without falsely rejecting the food; drafts remain available after errors.

Gemini quotas belong to the Google project, not the individual key. A backup key from the same project cannot provide independent quota. Check the key's project in Google AI Studio → Usage / Rate limits. Daily or zero quotas require a reset or an available model/project; repeated retries cannot fix them. No billing plan is changed by this configuration.

Provider documentation: https://ai.google.dev/gemini-api/docs/rate-limits
