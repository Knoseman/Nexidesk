import { describe, it, expect } from 'vitest';

// ── deriveCompanyName ───────────────────────────────────────────────────────

function deriveCompanyName(email: string): string | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  const common = [
    'gmail.com',
    'outlook.com',
    'hotmail.com',
    'yahoo.com',
    'icloud.com',
    'me.com',
    'live.com',
    'msn.com',
    'aol.com',
    'protonmail.com',
  ];
  if (common.includes(domain)) return null;
  const parts = domain.split('.');
  if (parts.length < 2) return null;
  const name =
    parts[parts.length - 2] === 'co' || parts[parts.length - 2] === 'com'
      ? parts[parts.length - 3]
      : parts[parts.length - 2];
  if (!name) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

describe('deriveCompanyName', () => {
  it('derives company from simple domain', () => {
    expect(deriveCompanyName('user@acme.com')).toBe('Acme');
    expect(deriveCompanyName('user@microsoft.org')).toBe('Microsoft');
  });

  it('handles .co.uk domains', () => {
    expect(deriveCompanyName('user@bbc.co.uk')).toBe('Bbc');
  });

  it('skips public providers', () => {
    expect(deriveCompanyName('user@gmail.com')).toBeNull();
    expect(deriveCompanyName('user@outlook.com')).toBeNull();
    expect(deriveCompanyName('user@protonmail.com')).toBeNull();
  });

  it('returns null for invalid emails', () => {
    expect(deriveCompanyName('invalid')).toBeNull();
    expect(deriveCompanyName('')).toBeNull();
  });
});

// ── extractRequesterName ────────────────────────────────────────────────────

function extractRequesterName(from: any): string | null {
  if (from && typeof from === 'object' && from.value?.[0]?.name) {
    return from.value[0].name;
  }
  if (typeof from === 'string') {
    const m = from.match(/^([^<]+)/);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

describe('extractRequesterName', () => {
  it('extracts from mailparser-like object', () => {
    const from = { value: [{ name: 'John Doe', address: 'john@example.com' }] };
    expect(extractRequesterName(from)).toBe('John Doe');
  });

  it('extracts from raw string', () => {
    expect(extractRequesterName('Jane Smith <jane@example.com>')).toBe('Jane Smith');
    expect(extractRequesterName('Bob')).toBe('Bob');
  });

  it('returns null if no name found', () => {
    expect(extractRequesterName('<only-email@example.com>')).toBeNull();
  });
});
