import "dotenv/config";
import { db } from "../src/lib/db";
import { messages, attachments } from "../src/lib/schema";
import { desc, eq } from "drizzle-orm";

async function run() {
  const msg = await db
    .select()
    .from(messages)
    .orderBy(desc(messages.createdAt))
    .limit(1);
  console.log("Latest message:", JSON.stringify(msg, null, 2));
  if (msg.length) {
    const atts = await db
      .select()
      .from(attachments)
      .where(eq(attachments.messageId, msg[0].id));
    console.log("Attachments:", JSON.stringify(atts, null, 2));
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
