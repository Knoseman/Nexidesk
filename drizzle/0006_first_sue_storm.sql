ALTER TABLE "messages" ADD COLUMN "bcc_emails" "citext"[];--> statement-breakpoint
ALTER TABLE "outbound_queue" ADD COLUMN "bcc_emails" "citext"[];