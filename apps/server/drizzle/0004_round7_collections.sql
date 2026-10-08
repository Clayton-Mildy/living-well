CREATE TABLE "follow_ups" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_ups_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "guest_hosts" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_hosts_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "guest_sessions" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_sessions_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "schedule_days" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_days_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "survey_templates" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_templates_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "task_done" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_done_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "task_templates" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_templates_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE INDEX "follow_ups_member_idx" ON "follow_ups" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "follow_ups_date_idx" ON "follow_ups" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "follow_ups_status_idx" ON "follow_ups" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "guest_hosts_member_idx" ON "guest_hosts" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "guest_hosts_date_idx" ON "guest_hosts" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "guest_hosts_status_idx" ON "guest_hosts" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "guest_sessions_member_idx" ON "guest_sessions" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "guest_sessions_date_idx" ON "guest_sessions" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "guest_sessions_status_idx" ON "guest_sessions" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "schedule_days_member_idx" ON "schedule_days" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "schedule_days_date_idx" ON "schedule_days" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "schedule_days_status_idx" ON "schedule_days" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "survey_templates_member_idx" ON "survey_templates" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "survey_templates_date_idx" ON "survey_templates" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "survey_templates_status_idx" ON "survey_templates" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "task_done_member_idx" ON "task_done" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "task_done_date_idx" ON "task_done" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "task_done_status_idx" ON "task_done" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "task_templates_member_idx" ON "task_templates" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "task_templates_date_idx" ON "task_templates" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "task_templates_status_idx" ON "task_templates" USING btree ("club_id","status");