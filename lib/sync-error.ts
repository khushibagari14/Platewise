export async function syncResponseError(response: Response, fallback: string) {
  try {
    const body: unknown = await response.json();
    if (
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof body.error === 'string'
    )
      return new Error(body.error);
  } catch {}
  return new Error(fallback);
}

export function syncErrorMessage(error: unknown) {
  return error instanceof Error &&
    error.name !== 'TimeoutError' &&
    error.name !== 'TypeError'
    ? error.message
    : 'Could not reach account storage. Keep this tab open and retry when connected.';
}
