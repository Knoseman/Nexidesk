import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

async function checkQueue() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing");
    return;
  }
  const sql = postgres(process.env.DATABASE_URL);
  try {
    const rows =
      await sql`SELECT id, status, last_error FROM outbound_queue ORDER BY created_at DESC LIMIT 5`;
    console.table(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

checkQueue();
