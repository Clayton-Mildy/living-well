CREATE TABLE "visit_calls" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visit_calls_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE INDEX "visit_calls_member_idx" ON "visit_calls" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "visit_calls_date_idx" ON "visit_calls" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "visit_calls_status_idx" ON "visit_calls" USING btree ("club_id","status");