ALTER TABLE "agents" ADD COLUMN "label_color_bg" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "label_color_text" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;