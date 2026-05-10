import { ImapFlow } from 'imapflow';
import { getImapAccessToken } from '@/lib/imap-access-token';
import { ingestInboundMime } from '@/lib/inbound';

function imapConfigured(): boolean {
  return Boolean(
    process.env.IMAP_USER &&
      process.env.IMAP_HOST &&
      process.env.IMAP_OAUTH_CLIENT_ID &&
      process.env.IMAP_OAUTH_REFRESH_TOKEN &&
      process.env.AZURE_AD_TENANT_ID,
  );
}

function inboxPath(): string {
  return process.env.IMAP_INBOX_PATH?.trim() || 'INBOX';
}

function ticketedPath(): string {
  const leaf = process.env.IMAP_TICKETED_LEAF?.trim() || 'Ticketed';
  const inbox = inboxPath();
  const delim =
    process.env.IMAP_MAILBOX_DELIM?.trim() ||
    (inbox.includes('/') && !inbox.includes('.') ? '/' : '.');
  return `${inbox}${delim}${leaf}`;
}

/**
 * Poll INBOX for unseen messages, ingest into DB, move to Ticketed subfolder.
 */
let pollInFlight = false;

export async function pollImap(): Promise<void> {
  if (pollInFlight) return;
  if (!imapConfigured()) {
    console.warn('[imap] skipped — set IMAP_USER, IMAP_HOST, IMAP OAuth env vars');
    return;
  }

  pollInFlight = true;
  try {
    await runPoll();
  } finally {
    pollInFlight = false;
  }
}

async function runPoll(): Promise<void> {
  const user = process.env.IMAP_USER!;
  const host = process.env.IMAP_HOST!;
  const accessToken = await getImapAccessToken();

  const client = new ImapFlow({
    host,
    port: 993,
    secure: true,
    auth: { user, accessToken },
    logger: false,
  });

  const inbox = inboxPath();
  const ticketed = ticketedPath();

  try {
    await client.connect();
    const lock = await client.getMailboxLock(inbox);
    try {
      const uids = await client.search({ seen: false }, { uid: true });
      if (!uids || uids.length === 0) {
        return;
      }

      await client.mailboxCreate(ticketed).catch(() => {
        /* exists */
      });

      for (const uid of uids) {
        try {
          const one = await client.fetchOne(uid, { source: true }, { uid: true });
          if (one === false || !one.source) continue;

          const result = await ingestInboundMime(one.source, uid);
          if (result === 'ingested' || result === 'duplicate') {
            await client.messageMove([uid], ticketed, { uid: true }).catch((moveErr) => {
              console.error('[imap] move to Ticketed failed (uid=%s):', uid, moveErr);
            });
          }
        } catch (msgErr) {
          console.error('[imap] failed to process message (uid=%s):', uid, msgErr);
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }
}
