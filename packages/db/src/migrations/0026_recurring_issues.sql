ALTER TABLE "issues" ADD COLUMN "recurrence_cron_expr" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "recurrence_text" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "recurrence_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "recurrence_last_spawned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "recurrence_parent_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_recurrence_parent_id_issues_id_fk" FOREIGN KEY ("recurrence_parent_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issues_recurrence_enabled_idx" ON "issues" USING btree ("company_id","recurrence_enabled");
