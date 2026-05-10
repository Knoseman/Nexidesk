-- M4: outbound queue claim lease for FOR UPDATE SKIP LOCKED workers
ALTER TABLE "outbound_queue" ADD COLUMN IF NOT EXISTS "processing_started_at" timestamptz;
