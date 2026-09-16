import 'server-only';
import { neon } from '@neondatabase/serverless';

export function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  if (!connectionString.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string.');
  }
  return neon(connectionString);
}
