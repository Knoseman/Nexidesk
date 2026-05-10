CREATE TABLE "autoresponder_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"subject" text DEFAULT 'Re: [{{ticket.number}}] {{ticket.subject}}' NOT NULL,
	"body_html" text DEFAULT '<p>Thank you for contacting us. Your request has been received and assigned ticket number <strong>{{ticket.number}}</strong>.</p><p>We will get back to you as soon as possible.</p>' NOT NULL,
	"body_text" text DEFAULT 'Thank you for contacting us. Your request has been received and assigned ticket number {{ticket.number}}.

We will get back to you as soon as possible.' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" bigint
);
--> statement-breakpoint
ALTER TABLE "outbound_queue" ALTER COLUMN "agent_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "autoresponder_config" ADD CONSTRAINT "autoresponder_config_updated_by_agents_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;