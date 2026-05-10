/**
 * Refreshes a delegated access token for IMAP XOAUTH2 (Outlook / M365 / Outlook.com).
 */

let cached: { token: string; expiresAt: number } | null = null;

/**
 * OAuth authority segment for IMAP public-client flows (device code + refresh).
 * - Work/school only: your tenant GUID (same as AZURE_AD_TENANT_ID).
 * - Personal @outlook.com / @hotmail.com mailbox: use `common` (app must allow
 *   "Personal Microsoft accounts" or "Accounts in any org directory + personal").
 */
function imapOAuthAuthority(): string {
  const fromEnv =
    process.env.IMAP_OAUTH_AUTHORITY?.trim() || process.env.AZURE_AD_TENANT_ID;
  if (!fromEnv) {
    throw new Error('Missing IMAP_OAUTH_AUTHORITY or AZURE_AD_TENANT_ID');
  }
  return fromEnv;
}

export async function getImapAccessToken(): Promise<string> {
  const clientId = process.env.IMAP_OAUTH_CLIENT_ID;
  const refresh = process.env.IMAP_OAUTH_REFRESH_TOKEN;
  if (!clientId || !refresh) {
    throw new Error('Missing IMAP_OAUTH_CLIENT_ID or IMAP_OAUTH_REFRESH_TOKEN');
  }

  const authority = imapOAuthAuthority();

  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refresh,
    scope: 'https://outlook.office.com/IMAP.AccessAsUser.All offline_access',
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
      data.error_description || data.error || 'IMAP OAuth token refresh failed',
    );
  }

  cached = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

export function clearImapAccessTokenCache(): void {
  cached = null;
}
