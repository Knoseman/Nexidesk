import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const { processOutboundQueueOnce } = await import("../src/lib/outbound");
  console.log("Running processOutboundQueueOnce()…");
  try {
    await processOutboundQueueOnce();
    console.log("Done.");
  } catch (err) {
    console.error("FATAL ERROR during processOutboundQueueOnce:", err);
  }
}

main().catch((e) => {
  console.error("CRITICAL BOOT ERROR:", e);
  process.exit(1);
});
