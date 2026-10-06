import type { MealAnalysis } from './nutrition';

export class AnalysisError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export async function requestMealAnalysis(
  form: FormData,
  userId: string,
): Promise<MealAnalysis> {
  let response: Response;
  try {
    response = await fetch('/api/analyze-meal', {
      method: 'POST',
      body: form,
      headers: { 'X-Platewise-Account': userId },
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    throw new AnalysisError(
      error !== null &&
        typeof error === 'object' &&
        'name' in error &&
        ['TimeoutError', 'AbortError'].includes(String(error.name))
        ? 'The analysis took too long. Your meal details are kept; please retry.'
        : 'Could not reach the analysis service. Your meal details are kept; check your connection and retry.',
    );
  }
  const body = (await response.json().catch(() => null)) as
    | (MealAnalysis & { error?: string; code?: string })
    | null;
  if (!response.ok) {
    throw new AnalysisError(
      body?.error ||
        (response.status === 413
          ? 'These photos are too large. Try adding fewer photos.'
          : 'The analysis service could not respond. Your meal details are kept; please retry.'),
      body?.code,
    );
  }
  if (!body || !Array.isArray(body.items) || !body.items.length)
    throw new AnalysisError(
      'The analysis was incomplete. Your meal details are kept; please retry.',
    );
  return body;
}
