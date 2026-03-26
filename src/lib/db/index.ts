import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

const queryClient = postgres(connectionString, {
  // Connection pool settings for serverless environments
  max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  idle_timeout: 20,        // Close idle connections after 20s
  connect_timeout: 10,     // Fail fast if DB is unreachable
  max_lifetime: 60 * 30,   // Recycle connections every 30 minutes
  // Required when using a connection pooler like PgBouncer/Supavisor in transaction mode
  prepare: process.env.DB_DISABLE_PREPARE === 'true' ? false : true,
});

export const db = drizzle(queryClient, { schema });
export const sqlClient = queryClient;
