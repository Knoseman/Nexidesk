/**
 * Delegated Graph access token for Mail.Send (same mailbox as IMAP).
 */

let cached: { token: string; expiresAt: number } | null = null;

function graphOAuthAuthority(): string {
  const fromEnv =
    process.env.GRAPH_OAUTH_AUTHORITY?.trim() ||
    process.env.IMAP_OAUTH_AUTHORITY?.trim() ||
    process.env.AZURE_AD_TENANT_ID;
  if (!fromEnv) {
    throw new Error('Missing GRAPH_OAUTH_AUTHORITY, IMAP_OAUTH_AUTHORITY, or AZURE_AD_TENANT_ID');
  }
  return fromEnv;
}

function graphClientId(): string {
  return (
    process.env.GRAPH_OAUTH_CLIENT_ID?.trim() ||
    process.env.IMAP_OAUTH_CLIENT_ID?.trim() ||
    process.env.AZURE_AD_CLIENT_ID ||
    ''
  );
}

function graphRefreshToken(): string {
  return process.env.GRAPH_OAUTH_REFRESH_TOKEN?.trim() || '';
}

export function graphSendConfigured(): boolean {
  return Boolean(graphClientId() && graphRefreshToken() && graphMailboxUser());
}

export function graphMailboxUser(): string {
  const u = process.env.GRAPH_MAILBOX_USER?.trim() || process.env.IMAP_USER?.trim();
  return u || '';
}

/**
 * Address shown to recipients in From:. Consumer Outlook accounts often use a primary
 * SMTP address like outlook_*@outlook.com; set GRAPH_MAILBOX_FROM to your @outlook.com alias
 * if recipients still see the internal address.
 */
export function graphMailboxFromAddress(): string {
  const from = process.env.GRAPH_MAILBOX_FROM?.trim();
  if (from) return from;
  return graphMailboxUser();
}

export function graphMailboxFromName(): string | undefined {
  const n = process.env.GRAPH_MAILBOX_FROM_NAME?.trim();
  return n || undefined;
}

/**
 * Refresh token must be minted for `https://graph.microsoft.com/Mail.Send` (see scripts/get-graph-token.mjs).
 * Do not use the IMAP-only refresh token — Entra does not allow mixing IMAP and Graph scopes in one consent.
 */
export async function getGraphAccessToken(): Promise<string> {
  const clientId = graphClientId();
  const refresh = graphRefreshToken();
  if (!clientId || !refresh) {
    throw new Error(
      'Missing Graph outbound OAuth: set GRAPH_OAUTH_REFRESH_TOKEN (pnpm graph:token) and client id',
    );
  }

  const authority = graphOAuthAuthority();

  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refresh,
    scope: 'https://graph.microsoft.com/Mail.Send offline_access',
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${authority}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  );

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!data.access_token) {
    throw new Error(
      data.error_description || data.error || 'Graph OAuth token refresh failed',
    );
  }

  cached = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

export function clearGraphAccessTokenCache(): void {
  cached = null;
}
