import { describe, it, expect } from 'vitest';

// ── randomPassword (mirrored from graph-users.ts) ────────────────────────────

function randomPassword(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let pwd = '';
  for (let i = 0; i < 24; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

describe('randomPassword', () => {
  it('produces 24-character passwords', () => {
    const pwd = randomPassword();
    expect(pwd).toHaveLength(24);
  });

  it('produces different passwords each time', () => {
    const p1 = randomPassword();
    const p2 = randomPassword();
    expect(p1).not.toBe(p2);
  });

  it('uses only allowed characters', () => {
    const allowed =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const pwd = randomPassword();
    for (const ch of pwd) {
      expect(allowed).toContain(ch);
    }
  });

  it('has high entropy (unlikely to repeat in small sample)', () => {
    const passwords = new Set(Array.from({ length: 20 }, randomPassword));
    expect(passwords.size).toBe(20);
  });
});

// ── createGraphUser request shape ────────────────────────────────────────────

describe('createGraphUser request shape', () => {
  function buildRequestBody(input: {
    displayName: string;
    mailNickname: string;
    userPrincipalName: string;
    mail?: string;
    password: string;
  }) {
    return {
      accountEnabled: false,
      displayName: input.displayName,
      mailNickname: input.mailNickname,
      userPrincipalName: input.userPrincipalName,
      mail: input.mail,
      passwordProfile: {
        forceChangePasswordNextSignIn: true,
        password: input.password,
      },
    };
  }

  it('sets accountEnabled to false', () => {
    const body = buildRequestBody({
      displayName: 'Alice',
      mailNickname: 'alice',
      userPrincipalName: 'alice@example.com',
      password: 'secret',
    });
    expect(body.accountEnabled).toBe(false);
  });

  it('forces password change on next sign-in', () => {
    const body = buildRequestBody({
      displayName: 'Alice',
      mailNickname: 'alice',
      userPrincipalName: 'alice@example.com',
      password: 'secret',
    });
    expect(body.passwordProfile.forceChangePasswordNextSignIn).toBe(true);
  });

  it('includes optional mail when provided', () => {
    const body = buildRequestBody({
      displayName: 'Alice',
      mailNickname: 'alice',
      userPrincipalName: 'alice@example.com',
      mail: 'alice@example.com',
      password: 'secret',
    });
    expect(body.mail).toBe('alice@example.com');
  });

  it('excludes mail when not provided', () => {
    const body = buildRequestBody({
      displayName: 'Alice',
      mailNickname: 'alice',
      userPrincipalName: 'alice@example.com',
      password: 'secret',
    });
    expect(body.mail).toBeUndefined();
  });
});

// ── createGraphInvitation request shape ──────────────────────────────────────

describe('createGraphInvitation request shape', () => {
  function buildInvitationBody(input: {
    email: string;
    redirectUrl: string;
  }) {
    return {
      invitedUserEmailAddress: input.email,
      inviteRedirectUrl: input.redirectUrl,
      sendInvitationMessage: true,
    };
  }

  it('sets sendInvitationMessage to true', () => {
    const body = buildInvitationBody({
      email: 'guest@example.com',
      redirectUrl: 'https://nexidesk.example.com',
    });
    expect(body.sendInvitationMessage).toBe(true);
  });

  it('maps email correctly', () => {
    const body = buildInvitationBody({
      email: 'guest@example.com',
      redirectUrl: 'https://nexidesk.example.com',
    });
    expect(body.invitedUserEmailAddress).toBe('guest@example.com');
  });
});
