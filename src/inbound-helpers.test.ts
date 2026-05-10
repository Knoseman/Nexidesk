import { describe, it, expect } from 'vitest';
import { stripMessageId, deriveCompanyName, parseReferences, getAddresses } from '@/lib/inbound';

// ── stripMessageId ───────────────────────────────────────────────────────────

describe('stripMessageId', () => {
  it('strips angle brackets', () => {
    expect(stripMessageId('<abc@def.com>')).toBe('abc@def.com');
  });

  it('trims whitespace', () => {
    expect(stripMessageId('  <abc@def.com>  ')).toBe('abc@def.com');
  });

  it('returns null for undefined', () => {
    expect(stripMessageId(undefined)).toBeNull();
  });

  it('returns null for null', () => {
    expect(stripMessageId(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(stripMessageId('')).toBeNull();
  });

  it('returns null for string containing only whitespace', () => {
    expect(stripMessageId('   ')).toBeNull();
  });

  it('handles id without brackets', () => {
    expect(stripMessageId('abc@def.com')).toBe('abc@def.com');
  });

  it('handles nested brackets', () => {
    expect(stripMessageId('<<abc@def.com>>')).toBe('abc@def.com');
  });
});

// ── deriveCompanyName ────────────────────────────────────────────────────────

describe('deriveCompanyName', () => {
  it('derives from simple .com', () => {
    expect(deriveCompanyName('user@acme.com')).toBe('Acme');
  });

  it('derives from .org', () => {
    expect(deriveCompanyName('user@microsoft.org')).toBe('Microsoft');
  });

  it('handles .co.uk', () => {
    expect(deriveCompanyName('user@bbc.co.uk')).toBe('Bbc');
  });

  it('handles .com.au', () => {
    expect(deriveCompanyName('user@acme.com.au')).toBe('Acme');
  });

  it('handles .io', () => {
    expect(deriveCompanyName('user@vercel.io')).toBe('Vercel');
  });

  it('handles .dev', () => {
    expect(deriveCompanyName('user@example.dev')).toBe('Example');
  });

  it('skips public providers', () => {
    expect(deriveCompanyName('user@gmail.com')).toBeNull();
    expect(deriveCompanyName('user@outlook.com')).toBeNull();
    expect(deriveCompanyName('user@protonmail.com')).toBeNull();
    expect(deriveCompanyName('user@icloud.com')).toBeNull();
    expect(deriveCompanyName('user@me.com')).toBeNull();
  });

  it('returns null for invalid emails', () => {
    expect(deriveCompanyName('invalid')).toBeNull();
    expect(deriveCompanyName('')).toBeNull();
    expect(deriveCompanyName('user@')).toBeNull();
  });

  it('handles subdomains', () => {
    expect(deriveCompanyName('user@mail.acme.com')).toBe('Acme');
  });

  it('returns null for single-part domains', () => {
    expect(deriveCompanyName('user@localhost')).toBeNull();
  });

  it('handles numeric domain parts', () => {
    expect(deriveCompanyName('user@12345.com')).toBe('12345');
  });

  it('capitalizes first letter only', () => {
    expect(deriveCompanyName('user@ACME.COM')).toBe('Acme');
  });
});

// ── parseReferences ──────────────────────────────────────────────────────────

describe('parseReferences', () => {
  it('returns empty array for null', () => {
    expect(parseReferences(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(parseReferences(undefined)).toEqual([]);
  });

  it('parses array of strings', () => {
    expect(parseReferences(['<a@b.com>', ' <c@d.com> '])).toEqual([
      'a@b.com',
      'c@d.com',
    ]);
  });

  it('parses space-separated string', () => {
    expect(parseReferences('<a@b.com> <c@d.com>')).toEqual(['a@b.com', 'c@d.com']);
  });

  it('parses newline-separated string', () => {
    expect(parseReferences('<a@b.com>\n<c@d.com>')).toEqual(['a@b.com', 'c@d.com']);
  });

  it('filters out empty results', () => {
    expect(parseReferences(['<a@b.com>', '', ' '])).toEqual(['a@b.com']);
  });

  it('handles single reference', () => {
    expect(parseReferences('<abc@def.com>')).toEqual(['abc@def.com']);
  });
});

// ── getAddresses ─────────────────────────────────────────────────────────────

describe('getAddresses', () => {
  it('returns empty array for null', () => {
    expect(getAddresses(null as any)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(getAddresses(undefined as any)).toEqual([]);
  });

  it('extracts addresses from mailparser object', () => {
    const obj = { value: [{ address: 'A@B.COM' }, { address: 'C@D.COM' }] };
    expect(getAddresses(obj as any)).toEqual(['a@b.com', 'c@d.com']);
  });

  it('filters out missing addresses', () => {
    const obj = { value: [{ address: 'a@b.com' }, { name: 'No Email' }] };
    expect(getAddresses(obj as any)).toEqual(['a@b.com']);
  });

  it('returns empty for non-object input', () => {
    expect(getAddresses('raw string' as any)).toEqual([]);
  });

  it('returns empty for empty value array', () => {
    expect(getAddresses({ value: [] } as any)).toEqual([]);
  });
});
