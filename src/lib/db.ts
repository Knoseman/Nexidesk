import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

// Single persistent connection pool — appropriate for Railway's always-on Node.js process.
// Neon requires SSL; the connection string from DATABASE_URL already includes sslmode=require.
const client = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
