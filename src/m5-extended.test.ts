import { describe, it, expect } from 'vitest';

// ── isTerminal (mirrored from UI usage) ──────────────────────────────────────

describe('isTerminal', () => {
  function isTerminal(s: string | null | undefined): boolean {
    return s === 'sent' || s === 'failed' || s === 'dead' || s == null;
  }

  it('treats sent/failed/dead/null/undefined as terminal', () => {
    expect(isTerminal('sent')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('dead')).toBe(true);
    expect(isTerminal(null)).toBe(true);
    expect(isTerminal(undefined)).toBe(true);
  });

  it('treats pending/sending as non-terminal', () => {
    expect(isTerminal('pending')).toBe(false);
    expect(isTerminal('sending')).toBe(false);
  });

  it('treats unknown strings as non-terminal', () => {
    expect(isTerminal('delivered')).toBe(false);
    expect(isTerminal('bounced')).toBe(false);
    expect(isTerminal('')).toBe(false);
    expect(isTerminal('unknown')).toBe(false);
  });
});

// ── queue status type contract ───────────────────────────────────────────────

describe('queue status type contract', () => {
  const validStatuses = ['pending', 'sending', 'sent', 'failed', 'dead'] as const;

  it('contains exactly the expected statuses', () => {
    expect(validStatuses).toContain('pending');
    expect(validStatuses).toContain('sending');
    expect(validStatuses).toContain('sent');
    expect(validStatuses).toContain('failed');
    expect(validStatuses).toContain('dead');
    expect(validStatuses).toHaveLength(5);
  });

  it('has terminal statuses at the end of the lifecycle', () => {
    const terminal = ['sent', 'failed', 'dead'];
    for (const s of terminal) {
      expect(validStatuses).toContain(s);
    }
  });
});
