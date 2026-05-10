/**
 * Idempotent: add outbound_queue.staged_message_id (M4) when missing.
 * Use when the DB was created from drizzle/0001_initial.sql without drizzle-kit migrate.
 */
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });
config();

const sql = process.env.DATABASE_URL;
if (!sql) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const db = postgres(sql, { max: 1 });

await db`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'outbound_queue'
        AND column_name = 'staged_message_id'
    ) THEN
      ALTER TABLE outbound_queue
        ADD COLUMN staged_message_id bigint REFERENCES messages (id);
    END IF;
  END $$;
`;
await db`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'outbound_queue'
        AND column_name = 'processing_started_at'
    ) THEN
      ALTER TABLE outbound_queue
        ADD COLUMN processing_started_at timestamptz;
    END IF;
  END $$;
`;
console.log('OK: outbound_queue.staged_message_id + processing_started_at present');
await db.end();
