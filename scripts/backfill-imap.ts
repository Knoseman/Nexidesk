/**
 * One-shot IMAP backfill — ingest historical messages from a mailbox folder.
 *
 * Usage:
 *   pnpm imap:backfill                     # Ticketed folder, last 90 days
 *   pnpm imap:backfill -- --days 180       # last 180 days
 *   pnpm imap:backfill -- --folder INBOX   # scan INBOX instead
 *   pnpm imap:backfill -- --dry-run        # print UIDs, no DB writes
 *
 * Dedup is handled by ingestInboundMime() — messages already in email_events
 * are counted as duplicates and silently skipped.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

import { ImapFlow } from "imapflow";
import { getImapAccessToken } from "../src/lib/imap-access-token";
import { ingestInboundMime } from "../src/lib/inbound";

interface Args {
  days: number;
  folder: string | undefined;
  dryRun: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let days = 90;
  let folder: string | undefined;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === "--days" || argv[i] === "-d") && argv[i + 1]) {
      days = parseInt(argv[++i], 10);
    } else if ((argv[i] === "--folder" || argv[i] === "-f") && argv[i + 1]) {
      folder = argv[++i];
    } else if (argv[i] === "--dry-run" || argv[i] === "-n") {
      dryRun = true;
    }
  }

  return { days, folder, dryRun };
}

export function backfillSinceDate(days: number): Date {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  d.setHours(0, 0, 0, 0);
  return d;
}

function defaultTicketedPath(): string {
  const inbox = process.env.IMAP_INBOX_PATH?.trim() || "INBOX";
  const leaf = process.env.IMAP_TICKETED_LEAF?.trim() || "Ticketed";
  const delim =
    process.env.IMAP_MAILBOX_DELIM?.trim() ||
    (inbox.includes("/") && !inbox.includes(".") ? "/" : ".");
  return `${inbox}${delim}${leaf}`;
}

async function main() {
  const { days, folder: folderArg, dryRun } = parseArgs();

  const user = process.env.IMAP_USER;
  const host = process.env.IMAP_HOST ?? "outlook.office365.com";

  if (!user) {
    console.error("Error: IMAP_USER env var not set");
    process.exit(1);
  }

  const folder = folderArg ?? defaultTicketedPath();
  const since = backfillSinceDate(days);

  console.log("Backfill parameters:");
  console.log(`  folder:   ${folder}`);
  console.log(`  since:    ${since.toISOString().slice(0, 10)} (${days} days)`);
  console.log(`  dry-run:  ${dryRun}`);
  console.log("");

  const accessToken = await getImapAccessToken();
  const client = new ImapFlow({
    host,
    port: 993,
    secure: true,
    auth: { user, accessToken },
    logger: false,
  });

  let total = 0;
  let ingested = 0;
  let duplicates = 0;
  let skipped = 0;
  let errors = 0;

  try {
    await client.connect();

    let lock;
    try {
      lock = await client.getMailboxLock(folder);
    } catch {
      console.error(`Error: folder not found or inaccessible — "${folder}"`);
      console.error("Tip: run with --folder to specify a different path");
      process.exit(1);
    }

    try {
      const uids = await client.search({ since }, { uid: true });
      const uidList = Array.isArray(uids) ? uids : [];
      total = uidList.length;
      console.log(`Found ${total} message(s)`);

      for (const uid of uidList) {
        process.stdout.write(`  uid=${uid} `);

        if (dryRun) {
          console.log("[dry-run]");
          continue;
        }

        try {
          const msg = await client.fetchOne(
            uid,
            { source: true },
            { uid: true },
          );
          if (!msg || !msg.source) {
            console.log("→ fetch failed (no source)");
            errors++;
            continue;
          }

          const result = await ingestInboundMime(msg.source, uid);
          console.log(`→ ${result}`);

          if (result === "ingested") ingested++;
          else if (result === "duplicate") duplicates++;
          else skipped++;
        } catch (err) {
          console.log("→ ERROR");
          console.error("    ", err instanceof Error ? err.message : err);
          errors++;
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

  console.log("");
  console.log("Backfill complete:");
  console.log(`  total:      ${total}`);
  console.log(`  ingested:   ${ingested}`);
  console.log(`  duplicates: ${duplicates}`);
  console.log(`  skipped:    ${skipped}`);
  console.log(`  errors:     ${errors}`);

  if (errors > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
