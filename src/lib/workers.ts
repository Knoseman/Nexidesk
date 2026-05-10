/**
 * startWorkers — called once on server boot via instrumentation.ts.
 *
 * M2: IMAP inbound poller (imapflow, setInterval 5 min).
 * M4: outbound queue processor (setInterval 30 s).
 * M9: daily GDPR retention purge (setInterval 24 h).
 */
const POLL_MS = parseInt(process.env.IMAP_POLL_MS ?? "300000", 10);
const RETENTION_INTERVAL_MS = parseInt(
  process.env.RETENTION_INTERVAL_MS ?? "86400000",
  10,
);

let imapStarted = false;

export function startWorkers(): void {
  if (imapStarted) return;
  imapStarted = true;

  void import("./imap")
    .then(({ pollImap }) => {
      pollImap().catch((err) => console.error("[imap] poll error:", err));
      setInterval(() => {
        pollImap().catch((err) => console.error("[imap] poll error:", err));
      }, POLL_MS);
    })
    .catch((err) => console.error("[imap] failed to load module:", err));

  void import("./outbound")
    .then(({ startOutboundWorker }) => {
      startOutboundWorker();
    })
    .catch((err) => console.error("[outbound] failed to load module:", err));

  void import("./gdpr")
    .then(({ runRetentionPurge }) => {
      setInterval(() => {
        runRetentionPurge().catch((err) =>
          console.error("[gdpr] retention purge error:", err),
        );
      }, RETENTION_INTERVAL_MS);
    })
    .catch((err) => console.error("[gdpr] failed to load module:", err));

  console.log("[workers] IMAP poller scheduled every %d min", POLL_MS / 60_000);
  console.log("[workers] GDPR retention purge scheduled every 24 h");
}
