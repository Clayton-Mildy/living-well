CREATE TABLE "activities" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activities_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "activity" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"club_id" text NOT NULL,
	"rev" integer NOT NULL,
	"at" text NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"mutation_id" text NOT NULL,
	"member_id" text,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "broadcasts_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "budget_adjustments" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_adjustments_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "budget_requests" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_requests_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "budget_sections" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_sections_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_events_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "change_requests" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "change_requests_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" text PRIMARY KEY NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_logs" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_logs_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "day_menus" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_menus_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "day_notices" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_notices_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "directory" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "directory_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "dishes" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dishes_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enquiries_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "family_contacts" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_contacts_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "family_links" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "family_links_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "form_requests" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "form_requests_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "guest_visits" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_visits_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "hr_notes" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_notes_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "invoice_runs" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_runs_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "member_notes" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_notes_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "members" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "members_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "menu_versions" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_versions_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "pending_charges" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pending_charges_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photos_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "plan_change_requests" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_change_requests_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "prices" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prices_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "readings" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "readings_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipts_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "schedule_versions" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_versions_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "staff_time" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_time_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "stock_requests" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_requests_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_responses_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "surveys" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "surveys_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "threads_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "vendor_invoices" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_invoices_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE TABLE "venue_bookings" (
	"club_id" text NOT NULL,
	"id" text NOT NULL,
	"member_id" text,
	"family_id" text,
	"date" text,
	"status" text,
	"kind" text,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_bookings_club_id_id_pk" PRIMARY KEY("club_id","id")
);
--> statement-breakpoint
CREATE INDEX "activities_member_idx" ON "activities" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "activities_date_idx" ON "activities" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "activities_status_idx" ON "activities" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "activity_member_idx" ON "activity" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "activity_date_idx" ON "activity" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "activity_status_idx" ON "activity" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "attendance_member_idx" ON "attendance" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "attendance_date_idx" ON "attendance" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "attendance_status_idx" ON "attendance" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "audit_club_rev_idx" ON "audit_log" USING btree ("club_id","rev");--> statement-breakpoint
CREATE INDEX "audit_member_idx" ON "audit_log" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "bookings_member_idx" ON "bookings" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "bookings_date_idx" ON "bookings" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "broadcasts_member_idx" ON "broadcasts" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "broadcasts_date_idx" ON "broadcasts" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "broadcasts_status_idx" ON "broadcasts" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "budget_adjustments_member_idx" ON "budget_adjustments" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "budget_adjustments_date_idx" ON "budget_adjustments" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "budget_adjustments_status_idx" ON "budget_adjustments" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "budget_requests_member_idx" ON "budget_requests" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "budget_requests_date_idx" ON "budget_requests" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "budget_requests_status_idx" ON "budget_requests" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "budget_sections_member_idx" ON "budget_sections" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "budget_sections_date_idx" ON "budget_sections" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "budget_sections_status_idx" ON "budget_sections" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "calendar_events_member_idx" ON "calendar_events" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "calendar_events_date_idx" ON "calendar_events" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "calendar_events_status_idx" ON "calendar_events" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "change_requests_member_idx" ON "change_requests" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "change_requests_date_idx" ON "change_requests" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "change_requests_status_idx" ON "change_requests" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "daily_logs_member_idx" ON "daily_logs" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "daily_logs_date_idx" ON "daily_logs" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "daily_logs_status_idx" ON "daily_logs" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "day_menus_member_idx" ON "day_menus" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "day_menus_date_idx" ON "day_menus" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "day_menus_status_idx" ON "day_menus" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "day_notices_member_idx" ON "day_notices" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "day_notices_date_idx" ON "day_notices" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "day_notices_status_idx" ON "day_notices" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "directory_member_idx" ON "directory" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "directory_date_idx" ON "directory" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "directory_status_idx" ON "directory" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "dishes_member_idx" ON "dishes" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "dishes_date_idx" ON "dishes" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "dishes_status_idx" ON "dishes" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "enquiries_member_idx" ON "enquiries" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "enquiries_date_idx" ON "enquiries" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "enquiries_status_idx" ON "enquiries" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "family_contacts_member_idx" ON "family_contacts" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "family_contacts_date_idx" ON "family_contacts" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "family_contacts_status_idx" ON "family_contacts" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "family_links_member_idx" ON "family_links" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "family_links_date_idx" ON "family_links" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "family_links_status_idx" ON "family_links" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "feedback_member_idx" ON "feedback" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "feedback_date_idx" ON "feedback" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "feedback_status_idx" ON "feedback" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "form_requests_member_idx" ON "form_requests" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "form_requests_date_idx" ON "form_requests" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "form_requests_status_idx" ON "form_requests" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "guest_visits_member_idx" ON "guest_visits" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "guest_visits_date_idx" ON "guest_visits" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "guest_visits_status_idx" ON "guest_visits" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "hr_notes_member_idx" ON "hr_notes" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "hr_notes_date_idx" ON "hr_notes" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "hr_notes_status_idx" ON "hr_notes" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "invoice_runs_member_idx" ON "invoice_runs" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "invoice_runs_date_idx" ON "invoice_runs" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "invoice_runs_status_idx" ON "invoice_runs" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "invoices_member_idx" ON "invoices" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "invoices_date_idx" ON "invoices" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "member_notes_member_idx" ON "member_notes" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "member_notes_date_idx" ON "member_notes" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "member_notes_status_idx" ON "member_notes" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "members_member_idx" ON "members" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "members_date_idx" ON "members" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "members_status_idx" ON "members" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "menu_versions_member_idx" ON "menu_versions" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "menu_versions_date_idx" ON "menu_versions" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "menu_versions_status_idx" ON "menu_versions" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "messages_member_idx" ON "messages" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "messages_date_idx" ON "messages" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "messages_status_idx" ON "messages" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "notifications_member_idx" ON "notifications" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "notifications_date_idx" ON "notifications" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "payments_member_idx" ON "payments" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "payments_date_idx" ON "payments" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "pending_charges_member_idx" ON "pending_charges" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "pending_charges_date_idx" ON "pending_charges" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "pending_charges_status_idx" ON "pending_charges" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "photos_member_idx" ON "photos" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "photos_date_idx" ON "photos" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "photos_status_idx" ON "photos" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "plan_change_requests_member_idx" ON "plan_change_requests" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "plan_change_requests_date_idx" ON "plan_change_requests" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "plan_change_requests_status_idx" ON "plan_change_requests" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "prices_member_idx" ON "prices" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "prices_date_idx" ON "prices" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "prices_status_idx" ON "prices" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "readings_member_idx" ON "readings" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "readings_date_idx" ON "readings" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "readings_status_idx" ON "readings" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "receipts_member_idx" ON "receipts" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "receipts_date_idx" ON "receipts" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "receipts_status_idx" ON "receipts" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "refunds_member_idx" ON "refunds" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "refunds_date_idx" ON "refunds" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "refunds_status_idx" ON "refunds" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "rooms_member_idx" ON "rooms" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "rooms_date_idx" ON "rooms" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "rooms_status_idx" ON "rooms" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "schedule_versions_member_idx" ON "schedule_versions" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "schedule_versions_date_idx" ON "schedule_versions" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "schedule_versions_status_idx" ON "schedule_versions" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "staff_member_idx" ON "staff" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "staff_date_idx" ON "staff" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "staff_status_idx" ON "staff" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "staff_time_member_idx" ON "staff_time" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "staff_time_date_idx" ON "staff_time" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "staff_time_status_idx" ON "staff_time" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "stock_requests_member_idx" ON "stock_requests" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "stock_requests_date_idx" ON "stock_requests" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "stock_requests_status_idx" ON "stock_requests" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "survey_responses_member_idx" ON "survey_responses" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "survey_responses_date_idx" ON "survey_responses" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "survey_responses_status_idx" ON "survey_responses" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "surveys_member_idx" ON "surveys" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "surveys_date_idx" ON "surveys" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "surveys_status_idx" ON "surveys" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "threads_member_idx" ON "threads" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "threads_date_idx" ON "threads" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "threads_status_idx" ON "threads" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "vendor_invoices_member_idx" ON "vendor_invoices" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "vendor_invoices_date_idx" ON "vendor_invoices" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "vendor_invoices_status_idx" ON "vendor_invoices" USING btree ("club_id","status");--> statement-breakpoint
CREATE INDEX "venue_bookings_member_idx" ON "venue_bookings" USING btree ("club_id","member_id");--> statement-breakpoint
CREATE INDEX "venue_bookings_date_idx" ON "venue_bookings" USING btree ("club_id","date");--> statement-breakpoint
CREATE INDEX "venue_bookings_status_idx" ON "venue_bookings" USING btree ("club_id","status");