CREATE TABLE "unpaid_follow_ups" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unpaid_follow_ups_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE INDEX "unpaid_follow_ups_member_idx" ON "unpaid_follow_ups" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "unpaid_follow_ups_date_idx" ON "unpaid_follow_ups" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "unpaid_follow_ups_status_idx" ON "unpaid_follow_ups" USING btree ("club_id","status");