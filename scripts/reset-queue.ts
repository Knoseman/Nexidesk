import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function resetQueue() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing');
    return;
  }
  const sql = postgres(process.env.DATABASE_URL);
  try {
    const result = await sql`
      UPDATE outbound_queue
      SET status = 'pending', attempts = 0, last_error = null
      WHERE status = 'dead'
    `;
    console.log('Reset %s dead rows to pending.', result.count);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

resetQueue();
