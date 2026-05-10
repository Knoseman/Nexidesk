import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import os from 'os';

// Pure helper logic mirrored from scripts/backfill-imap.ts and scripts/backup-db.ts.
// Tests validate the algorithms; integration (IMAP connection, DB writes) requires a live env.

function backfillSinceDate(days: number): Date {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  d.setHours(0, 0, 0, 0);
  return d;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function backupTimestamp(d = new Date()): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}`
  );
}

function rotateDumps(dir: string, keep: number): string[] {
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => f.startsWith('nexidesk-') && f.endsWith('.sql.gz'))
      .sort();
  } catch {
    return [];
  }
  const toDelete = files.slice(0, Math.max(0, files.length - keep));
  for (const f of toDelete) unlinkSync(join(dir, f));
  return toDelete;
}

// ── backfill date logic ───────────────────────────────────────────────────────

describe('backfillSinceDate', () => {
  it('returns a date N days in the past', () => {
    const d = backfillSinceDate(90);
    const diffDays = (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThanOrEqual(90);
    expect(diffDays).toBeLessThan(91);
  });

  it('zeroes hours, minutes, seconds, ms', () => {
    const d = backfillSinceDate(30);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it('works for 0 days (today at midnight)', () => {
    const d = backfillSinceDate(0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(d.getFullYear()).toBe(today.getFullYear());
    expect(d.getMonth()).toBe(today.getMonth());
    expect(d.getDate()).toBe(today.getDate());
  });
});

// ── backup timestamp ──────────────────────────────────────────────────────────

describe('backupTimestamp', () => {
  it('formats as YYYY-MM-DD_HH-MM', () => {
    const ts = backupTimestamp(new Date());
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$/);
  });

  it('zero-pads single-digit month, day, hour, minute', () => {
    const d = new Date(2026, 0, 5, 9, 3);  // Jan 5, 09:03 local
    expect(backupTimestamp(d)).toBe('2026-01-05_09-03');
  });
});

// ── rotation logic ────────────────────────────────────────────────────────────

describe('rotateDumps', () => {
  const tmpDir = join(os.tmpdir(), `nexidesk-rot-test-${process.pid}`);

  it('deletes oldest dumps beyond the keep count', () => {
    mkdirSync(tmpDir, { recursive: true });
    const files = [
      'nexidesk-2026-01-01_03-00.sql.gz',
      'nexidesk-2026-01-02_03-00.sql.gz',
      'nexidesk-2026-01-03_03-00.sql.gz',
      'nexidesk-2026-01-04_03-00.sql.gz',
    ];
    for (const f of files) writeFileSync(join(tmpDir, f), '');

    const deleted = rotateDumps(tmpDir, 2);

    expect(deleted).toHaveLength(2);
    expect(deleted).toContain('nexidesk-2026-01-01_03-00.sql.gz');
    expect(deleted).toContain('nexidesk-2026-01-02_03-00.sql.gz');
    expect(existsSync(join(tmpDir, 'nexidesk-2026-01-03_03-00.sql.gz'))).toBe(true);
    expect(existsSync(join(tmpDir, 'nexidesk-2026-01-04_03-00.sql.gz'))).toBe(true);

    rmSync(tmpDir, { recursive: true });
  });

  it('does nothing when count is within keep limit', () => {
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(join(tmpDir, 'nexidesk-2026-01-01_03-00.sql.gz'), '');

    const deleted = rotateDumps(tmpDir, 7);
    expect(deleted).toHaveLength(0);

    rmSync(tmpDir, { recursive: true });
  });

  it('returns empty array for a non-existent directory', () => {
    expect(rotateDumps('/nonexistent/xyz-999', 7)).toEqual([]);
  });
});
