/**
 * Custom migration runner that uses drizzle-orm/postgres-js/migrator
 * directly instead of the drizzle-kit CLI.
 *
 * Plain ESM (no TypeScript) so it runs under `node` in production
 * without needing `tsx` to be in the runtime image.
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = postgres(url, {
    max: 1,
    connect_timeout: 15,
    idle_timeout: 20,
  });

  const db = drizzle(client);

  console.log('Applying migrations...');

  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations applied successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
