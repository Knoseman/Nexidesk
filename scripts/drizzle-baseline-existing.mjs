import { config } from 'dotenv';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

/** Baseline drizzle.__drizzle_migrations for migrations that were applied outside
 *  the migration system (e.g. via db:push or manual SQL). Inserts rows for any
 *  journal entries whose hash is not already present in the migrations table.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

config({ path: path.join(root, '.env.local') });
config({ path: path.join(root, '.env') });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

function hashFile(relPath) {
  const q = fs.readFileSync(path.join(root, relPath), 'utf8');
  return createHash('sha256').update(q).digest('hex');
}

const journal = JSON.parse(
  fs.readFileSync(path.join(root, 'drizzle', 'meta', '_journal.json'), 'utf8'),
);

const s = postgres(url, { max: 1, connect_timeout: 15 });

try {
  // Ensure the drizzle schema and migrations table exist
  await s`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await s`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )`;

  const existing = await s`select hash from drizzle.__drizzle_migrations`;
  const existingHashes = new Set(existing.map(r => r.hash));

  const toMark = [];
  for (const entry of journal.entries) {
    const tag = entry.tag;
    const sqlPath = `drizzle/${tag}.sql`;
    if (!fs.existsSync(path.join(root, sqlPath))) {
      console.error('Missing file', sqlPath);
      process.exit(1);
    }
    const hash = hashFile(sqlPath);
    const when = Number(entry.when);

    if (existingHashes.has(hash)) {
      console.log(`Already tracked: ${tag}`);
      continue;
    }

    toMark.push({ hash, when, tag });
  }

  if (toMark.length === 0) {
    console.log('All migrations already tracked. Nothing to baseline.');
    process.exit(0);
  }

  console.log('Inserting baseline migration rows for:', toMark.map((m) => m.tag).join(', '));
  for (const row of toMark) {
    await s`insert into drizzle.__drizzle_migrations ("hash", "created_at") values (${row.hash}, ${row.when})`;
  }
  console.log('Baseline complete.');
} catch (err) {
  console.error('Baseline failed:', err);
  process.exit(1);
} finally {
  await s.end();
}
