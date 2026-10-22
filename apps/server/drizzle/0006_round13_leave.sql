CREATE TABLE "leave_requests" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leave_requests_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE INDEX "leave_requests_member_idx" ON "leave_requests" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "leave_requests_date_idx" ON "leave_requests" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "leave_requests_status_idx" ON "leave_requests" USING btree ("club_id","status");