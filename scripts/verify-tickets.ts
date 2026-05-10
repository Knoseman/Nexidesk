import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  try {
    const tickets = await sql`SELECT COUNT(*) as count FROM tickets`;
    const messages = await sql`SELECT COUNT(*) as count FROM messages`;
    
    console.log("📊 Test Data Verification:");
    console.log(`✓ Total Tickets: ${tickets[0].count}`);
    console.log(`✓ Total Messages: ${messages[0].count}`);
    if (tickets[0].count > 0) {
      console.log(`✓ Avg Messages per Ticket: ${(messages[0].count / tickets[0].count).toFixed(1)}`);
    }
  } finally {
    await sql.end();
  }
}

main();
