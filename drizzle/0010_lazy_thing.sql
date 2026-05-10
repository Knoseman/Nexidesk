ALTER TABLE "tickets" ADD COLUMN "merged_into_ticket_id" bigint;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_merged_into_ticket_id_tickets_id_fk" FOREIGN KEY ("merged_into_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tickets_merged_into" ON "tickets" USING btree ("merged_into_ticket_id");