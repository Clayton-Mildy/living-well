CREATE TABLE "care_calls" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "care_calls_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "celebrations" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "celebrations_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "mood_marks" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mood_marks_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE INDEX "care_calls_member_idx" ON "care_calls" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "care_calls_date_idx" ON "care_calls" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "care_calls_status_idx" ON "care_calls" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "celebrations_member_idx" ON "celebrations" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "celebrations_date_idx" ON "celebrations" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "celebrations_status_idx" ON "celebrations" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "mood_marks_member_idx" ON "mood_marks" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "mood_marks_date_idx" ON "mood_marks" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "mood_marks_status_idx" ON "mood_marks" USING btree ("club_id","status");