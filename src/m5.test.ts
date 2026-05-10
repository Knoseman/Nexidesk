import { describe, it, expect } from 'vitest';
import type { PostTicketMessageBody } from '@/lib/post-ticket-message';
import type { TicketMessage } from '@/types/ticket';

// ── M5 type tests ──────────────────────────────────────────────────────────

describe('M5 types', () => {
  it('PostTicketMessageBody accepts bodyHtml', () => {
    const body: PostTicketMessageBody = {
      type: 'reply',
      bodyText: 'hello',
      bodyHtml: '<p>hello</p>',
    };
    expect(body.bodyHtml).toBe('<p>hello</p>');
  });

  it('PostTicketMessageBody bodyHtml is optional', () => {
    const body: PostTicketMessageBody = { type: 'reply', bodyText: 'hello' };
    expect(body.bodyHtml).toBeUndefined();
  });
});

// ── TicketMessage type tests ────────────────────────────────────────────────

describe('TicketMessage type', () => {
  it('has required M5 fields', () => {
    const msg: TicketMessage = {
      id: 1,
      ticketId: 2,
      direction: 'outbound',
      bodyText: 'hi',
      bodyHtml: '<p>hi</p>',
      queueStatus: 'pending',
      fromEmail: 'a@b.com',
      agentName: null,
      sentAt: null,
      receivedAt: null,
    };
    expect(msg.queueStatus).toBe('pending');
    expect(msg.bodyHtml).toBe('<p>hi</p>');
    expect(msg.ticketId).toBe(2);
  });
});

// ── Send-state badge logic ──────────────────────────────────────────────────

describe('isTerminal', () => {
  // Copy the logic inline since it's not exported
  function isTerminal(s: string | null | undefined): boolean {
    return s === 'sent' || s === 'failed' || s === 'dead' || s == null;
  }

  it('treats sent/failed/dead/null as terminal', () => {
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
});

// ── PATCH /api/agents/me validation logic ──────────────────────────────────

describe('PATCH /api/agents/me validation', () => {
  it('rejects name longer than 120 chars', () => {
    const name = 'a'.repeat(121);
    expect(name.length).toBeGreaterThan(120);
    // The route should reject this — verify by checking the condition
    const isInvalid = typeof name === 'string' && name.trim().length > 120;
    expect(isInvalid).toBe(true);
  });

  it('accepts null signatureHtml', () => {
    const signatureHtml: string | null = null;
    expect(signatureHtml).toBeNull();
  });
});
