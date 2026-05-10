import { describe, it, expect } from 'vitest';

// Status-transition logic mirrored from src/lib/inbound.ts (existing ticket branch).
// Kept inline so this test has no DB dependency.
function resolveStatus(currentStatus: string | undefined): {
  newStatus: string | undefined;
  reopening: boolean;
} {
  const reopening =
    currentStatus === 'pending' ||
    currentStatus === 'resolved' ||
    currentStatus === 'closed';
  return { newStatus: reopening ? 'open' : currentStatus, reopening };
}

describe('auto-reopen on inbound reply', () => {
  it('reopens pending → open', () => {
    const { newStatus, reopening } = resolveStatus('pending');
    expect(newStatus).toBe('open');
    expect(reopening).toBe(true);
  });

  it('reopens resolved → open', () => {
    const { newStatus, reopening } = resolveStatus('resolved');
    expect(newStatus).toBe('open');
    expect(reopening).toBe(true);
  });

  it('reopens closed → open', () => {
    const { newStatus, reopening } = resolveStatus('closed');
    expect(newStatus).toBe('open');
    expect(reopening).toBe(true);
  });

  it('leaves open unchanged', () => {
    const { newStatus, reopening } = resolveStatus('open');
    expect(newStatus).toBe('open');
    expect(reopening).toBe(false);
  });

  it('leaves new unchanged', () => {
    const { newStatus, reopening } = resolveStatus('new');
    expect(newStatus).toBe('new');
    expect(reopening).toBe(false);
  });

  it('clears closedAt only when reopening', () => {
    // Simulate the spread used in the DB update
    const buildSet = (status: string) => {
      const { reopening } = resolveStatus(status);
      return { status: 'open', ...(reopening ? { closedAt: null } : {}) };
    };
    expect(buildSet('closed')).toHaveProperty('closedAt', null);
    expect(buildSet('pending')).toHaveProperty('closedAt', null);
    expect(buildSet('open')).not.toHaveProperty('closedAt');
  });
});
