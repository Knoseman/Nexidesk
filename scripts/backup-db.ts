/**
 * pg_dump backup with rotation.
 *
 * Requires pg_dump in PATH (PostgreSQL client tools).
 * Saves compressed SQL dumps to the ./backups/ directory.
 * Keeps the last BACKUP_KEEP files (default 7) and removes older ones.
 *
 * Usage:
 *   pnpm db:backup             # dump to backups/nexidesk-YYYY-MM-DD_HH-MM.sql.gz
 *   BACKUP_KEEP=14 pnpm db:backup
 *
 * On Windows, install PostgreSQL client tools or use WSL.
 * On Railway, add a pg-client layer or run this locally against the Neon URL.
 */
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

import { spawn } from 'child_process';
import { createWriteStream, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { createGzip } from 'zlib';
import { join } from 'path';

const BACKUP_DIR = 'backups';
const KEEP = parseInt(process.env.BACKUP_KEEP ?? '7', 10);

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function backupTimestamp(d = new Date()): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}`
  );
}

function runPgDump(databaseUrl: string, outFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const gz = createGzip({ level: 6 });
    const out = createWriteStream(outFile);

    const pg = spawn('pg_dump', [
      '--no-password',
      '--format=plain',
      '--no-owner',
      '--no-acl',
      databaseUrl,
    ]);

    let stderrBuf = '';
    pg.stderr.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });

    pg.stdout.pipe(gz).pipe(out);

    out.on('finish', resolve);

    pg.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(
          new Error(
            'pg_dump not found in PATH — install PostgreSQL client tools',
          ),
        );
      } else {
        reject(err);
      }
    });

    pg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`pg_dump exited with code ${code}:\n${stderrBuf.trim()}`));
      }
    });
  });
}

export function rotateDumps(dir: string, keep: number): string[] {
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => f.startsWith('nexidesk-') && f.endsWith('.sql.gz'))
      .sort();
  } catch {
    return [];
  }

  const toDelete = files.slice(0, Math.max(0, files.length - keep));
  for (const f of toDelete) {
    unlinkSync(join(dir, f));
  }
  return toDelete;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Error: DATABASE_URL not set');
    process.exit(1);
  }

  mkdirSync(BACKUP_DIR, { recursive: true });

  const outFile = join(BACKUP_DIR, `nexidesk-${backupTimestamp()}.sql.gz`);
  console.log(`Dumping database → ${outFile}`);

  await runPgDump(url, outFile);

  const stat = statSync(outFile);
  console.log(`Done — ${(stat.size / 1024).toFixed(1)} KB`);

  const deleted = rotateDumps(BACKUP_DIR, KEEP);
  for (const f of deleted) {
    console.log(`Rotated out: ${f}`);
  }
  console.log(`Keeping last ${KEEP} backup(s).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
