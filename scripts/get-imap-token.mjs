/**
 * get-imap-token.mjs
 *
 * Gets a delegated IMAP XOAUTH2 refresh token for a shared mailbox.
 *
 * Usage:
 *   node scripts/get-imap-token.mjs              # browser redirect (nativeclient)
 *   node scripts/get-imap-token.mjs --device-code  # no redirect — use if you land on /common/wrongplace
 *
 * Prerequisites:
 *   - IMAP.AccessAsUser.All delegated + admin consent
 *   - "Allow public client flows" enabled
 *   - Native redirect URI (for default mode):
 *     https://login.microsoftonline.com/common/oauth2/nativeclient
 *
 * Outbound (Graph Mail.Send): run `pnpm graph:token` separately — Microsoft does not allow combining
 *   outlook.office.com (IMAP) and graph.microsoft.com scopes in one request (AADSTS70011).
 *
 * Personal @outlook.com: set IMAP_OAUTH_AUTHORITY=common and allow personal accounts on the app, then re-run.
 */

import { createInterface } from 'readline';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const CLIENT_ID =
  process.env.IMAP_OAUTH_CLIENT_ID || process.env.AZURE_AD_CLIENT_ID;
const OAUTH_AUTHORITY =
  process.env.IMAP_OAUTH_AUTHORITY?.trim() || process.env.AZURE_AD_TENANT_ID;

if (!CLIENT_ID || !OAUTH_AUTHORITY) {
  console.error(
    'Missing env: set AZURE_AD_CLIENT_ID (or IMAP_OAUTH_CLIENT_ID) and AZURE_AD_TENANT_ID or IMAP_OAUTH_AUTHORITY',
  );
  process.exit(1);
}

const REDIRECT_URI =
  'https://login.microsoftonline.com/common/oauth2/nativeclient';
const SCOPES = [
  'https://outlook.office.com/IMAP.AccessAsUser.All',
  'offline_access',
].join(' ');

const TOKEN_URL = `https://login.microsoftonline.com/${OAUTH_AUTHORITY}/oauth2/v2.0/token`;

function printSuccess(data) {
  console.log('=== SUCCESS ===\n');
  console.log('Add or merge these into .env.local:\n');
  console.log(`IMAP_OAUTH_CLIENT_ID=${CLIENT_ID}`);
  if (OAUTH_AUTHORITY !== process.env.AZURE_AD_TENANT_ID?.trim()) {
    console.log(`IMAP_OAUTH_AUTHORITY=${OAUTH_AUTHORITY}`);
  }
  console.log(`IMAP_OAUTH_REFRESH_TOKEN=${data.refresh_token}`);
  console.log('');
  console.log(
    'Next: run `pnpm graph:token` (or `node scripts/get-graph-token.mjs --device-code`) as the SAME mailbox user to obtain GRAPH_OAUTH_REFRESH_TOKEN for outbound send.',
  );
  console.log(
    '\nThe access_token expires in',
    Math.round(data.expires_in / 60),
    'minutes.',
  );
  console.log('The refresh_token does not expire unless unused for 90 days.');
}

async function deviceCodeFlow() {
  const start = new URLSearchParams({
    client_id: CLIENT_ID,
    scope: SCOPES,
  });
  const deviceRes = await fetch(
    `https://login.microsoftonline.com/${OAUTH_AUTHORITY}/oauth2/v2.0/devicecode`,
    { method: 'POST', body: start, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  const device = await deviceRes.json();
  if (device.error) {
    console.error('Device code start failed:', device.error, device.error_description);
    process.exit(1);
  }

  console.log('\n=== Device code flow (no browser redirect) ===\n');
  console.log(device.message);
  console.log('\nOpen:', device.verification_uri);
  console.log('Enter code:', device.user_code);
  console.log('\nWaiting until you complete sign-in in the browser...\n');

  let pollIntervalMs = (device.interval || 5) * 1000;
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    client_id: CLIENT_ID,
    device_code: device.device_code,
  });

  const deadline = Date.now() + (device.expires_in || 900) * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const data = await tokenRes.json();
    if (data.error === 'authorization_pending') continue;
    if (data.error === 'slow_down') {
      pollIntervalMs += 5000;
      continue;
    }
    if (data.error) {
      console.error('Token failed:', data.error, data.error_description);
      process.exit(1);
    }
    printSuccess(data);
    return;
  }
  console.error('Timed out waiting for device authorization.');
  process.exit(1);
}

async function authorizationCodeFlow() {
  const authUrl =
    `https://login.microsoftonline.com/${OAUTH_AUTHORITY}/oauth2/v2.0/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&prompt=select_account`;

  console.log('\n=== Step 1: Open this URL in your browser ===\n');
  console.log(authUrl);
  console.log(
    '\nSign in as the SHARED MAILBOX account (or a licensed account with Full Access to it).',
  );
  console.log('After sign-in the address bar should contain ?code=...');
  console.log(
    '\nIf you land on .../common/wrongplace instead (no code), stop and run:',
  );
  console.log('  node scripts/get-imap-token.mjs --device-code\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const redirected = await new Promise((resolve) => {
    rl.question('Paste the redirect URL here: ', resolve);
  });
  rl.close();

  let code;
  try {
    const url = new URL(redirected.trim());
    code = url.searchParams.get('code');
    if (!code) throw new Error('No "code" param found in URL');
  } catch (e) {
    console.error('\nCould not parse URL:', e.message);
    process.exit(1);
  }

  console.log('\n=== Step 2: Exchanging code for tokens... ===\n');

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const data = await res.json();

  if (data.error) {
    console.error('Token exchange failed:', data.error, data.error_description);
    process.exit(1);
  }

  printSuccess(data);
}

const useDevice = process.argv.includes('--device-code');
if (useDevice) {
  await deviceCodeFlow();
} else {
  await authorizationCodeFlow();
}
