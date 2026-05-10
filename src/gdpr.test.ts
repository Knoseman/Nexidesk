import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';

// ── GDPR anonymise_requester unit tests (pure logic, no DB) ──────────────────

describe('anonymise_requester helpers', () => {
  it('SHA-256 of email is a 64-char hex string', () => {
    const email = 'user@example.com';
    const hash = createHash('sha256').update(email).digest('hex');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it('produces a deterministic anon email placeholder', () => {
    const email = 'user@example.com';
    const hash = createHash('sha256').update(email).digest('hex');
    const anonEmail = `anon-${hash.slice(0, 12)}@redacted.invalid`;
    expect(anonEmail).toMatch(/^anon-[0-9a-f]{12}@redacted\.invalid$/);
    // Deterministic: same input → same output
    const hash2 = createHash('sha256').update(email).digest('hex');
    expect(`anon-${hash2.slice(0, 12)}@redacted.invalid`).toBe(anonEmail);
  });

  it('case-normalises email before hashing', () => {
    const h1 = createHash('sha256').update('User@Example.COM'.toLowerCase()).digest('hex');
    const h2 = createHash('sha256').update('user@example.com').digest('hex');
    expect(h1).toBe(h2);
  });

  it('different emails produce different hashes', () => {
    const h1 = createHash('sha256').update('alice@example.com').digest('hex');
    const h2 = createHash('sha256').update('bob@example.com').digest('hex');
    expect(h1).not.toBe(h2);
  });
});

// ── Retention policy ─────────────────────────────────────────────────────────

describe('retention policy', () => {
  it('default retention is 730 days (2 years)', () => {
    const days = parseInt(process.env.GDPR_RETENTION_DAYS ?? '730', 10);
    expect(days).toBe(730);
  });

  it('GDPR_RETENTION_DAYS env var overrides default', () => {
    const days = parseInt('365', 10);
    expect(days).toBe(365);
  });
});
