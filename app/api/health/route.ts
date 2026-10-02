import { database, DatabaseRequestError, DatabaseUnavailable } from '@/lib/db';

export async function GET() {
  try {
    await database('health-check').checkConnection();
    return Response.json(
      { storageReady: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const reason =
      error instanceof DatabaseUnavailable
        ? 'not_configured'
        : error instanceof DatabaseRequestError &&
            [401, 403].includes(error.status)
          ? 'credentials_rejected'
          : error instanceof DatabaseRequestError && error.status === 404
            ? 'schema_missing'
            : 'unreachable';
    return Response.json(
      { storageReady: false, reason },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
