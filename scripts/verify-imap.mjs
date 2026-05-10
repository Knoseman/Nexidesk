/**
 * Dev-only: refresh IMAP OAuth token and open INBOX (no secrets printed).
 * Usage: node scripts/verify-imap.mjs
 */
import { config } from 'dotenv';
import { ImapFlow } from 'imapflow';

config({ path: '.env.local' });
config();

async function refreshAccessToken() {
  const authority =
    process.env.IMAP_OAUTH_AUTHORITY?.trim() || process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.IMAP_OAUTH_CLIENT_ID;
  const refreshToken = process.env.IMAP_OAUTH_REFRESH_TOKEN;
  if (!authority || !clientId || !refreshToken) {
    throw new Error('Missing IMAP_OAUTH_* / AZURE_AD_TENANT_ID / IMAP_OAUTH_AUTHORITY');
  }
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
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
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(
      [data.error, data.error_description].filter(Boolean).join(' — ') ||
        'token refresh failed',
    );
  }
  return data.access_token;
}

async function main() {
  console.log('1) OAuth refresh…');
  const accessToken = await refreshAccessToken();
  console.log('   OK (access token received)');

  const user = process.env.IMAP_USER;
  const host = process.env.IMAP_HOST;
  if (!user || !host) throw new Error('Missing IMAP_USER or IMAP_HOST');

  console.log('2) IMAP connect + INBOX…');
  const client = new ImapFlow({
    host,
    port: 993,
    secure: true,
    auth: { user, accessToken },
    logger: false,
  });
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  try {
    const unseen = await client.search({ seen: false }, { uid: true });
    const n = Array.isArray(unseen) ? unseen.length : 0;
    console.log('   OK — INBOX unseen messages:', n);
  } finally {
    lock.release();
  }
  try {
    await client.logout();
  } catch {
    client.close();
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error('FAIL:', e instanceof Error ? e.message : e);
  process.exit(1);
});
