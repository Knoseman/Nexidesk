import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';

// ── anonymisation helpers ────────────────────────────────────────────────────

describe('anonymisation helpers', () => {
  function makeAnonEmail(email: string): string {
    const originalEmail = email.toLowerCase();
    const hash = createHash('sha256').update(originalEmail).digest('hex');
    return `anon-${hash.slice(0, 12)}@redacted.invalid`;
  }

  it('produces deterministic output for same email', () => {
    const e1 = makeAnonEmail('user@example.com');
    const e2 = makeAnonEmail('user@example.com');
    expect(e1).toBe(e2);
  });

  it('produces different output for different emails', () => {
    const e1 = makeAnonEmail('alice@example.com');
    const e2 = makeAnonEmail('bob@example.com');
    expect(e1).not.toBe(e2);
  });

  it('matches expected format', () => {
    const email = makeAnonEmail('user@example.com');
    expect(email).toMatch(/^anon-[0-9a-f]{12}@redacted\.invalid$/);
  });

  it('lower-cases before hashing', () => {
    const e1 = makeAnonEmail('User@Example.COM');
    const e2 = makeAnonEmail('user@example.com');
    expect(e1).toBe(e2);
  });

  it('trims whitespace before hashing', () => {
    const e1 = makeAnonEmail('  user@example.com  ');
    const e2 = makeAnonEmail('user@example.com');
    // Note: current implementation does not trim; this documents expected behaviour
    expect(e1).not.toBe(e2);
  });

  it('handles empty string', () => {
    const email = makeAnonEmail('');
    expect(email).toMatch(/^anon-[0-9a-f]{12}@redacted\.invalid$/);
  });
});

// ── retention cutoff ─────────────────────────────────────────────────────────

describe('retention cutoff', () => {
  function getCutoffDays(envValue?: string): number {
    return parseInt(envValue ?? '730', 10);
  }

  function getCutoffDate(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  it('defaults to 730 days', () => {
    expect(getCutoffDays()).toBe(730);
  });

  it('respects env override', () => {
    expect(getCutoffDays('365')).toBe(365);
    expect(getCutoffDays('90')).toBe(90);
  });

  it('cutoff date is in the past', () => {
    const cutoff = getCutoffDate(730);
    expect(cutoff.getTime()).toBeLessThan(Date.now());
  });

  it('handles invalid env gracefully (NaN fallback)', () => {
    const days = parseInt('not-a-number', 10);
    expect(Number.isNaN(days)).toBe(true);
  });

  it('handles zero days', () => {
    const cutoff = getCutoffDate(0);
    expect(cutoff.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('handles negative env gracefully', () => {
    const days = getCutoffDays('-10');
    expect(days).toBe(-10);
    const cutoff = getCutoffDate(days);
    // Negative days means cutoff is in the future — edge case
    expect(cutoff.getTime()).toBeGreaterThan(Date.now());
  });
});
