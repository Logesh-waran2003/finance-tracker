CREATE TYPE "public"."attendance_status" AS ENUM('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE', 'WEEK_OFF');--> statement-breakpoint
CREATE TYPE "public"."collection_status" AS ENUM('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."due_status" AS ENUM('OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."ledger_entity_type" AS ENUM('collection', 'expense', 'reconciliation');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('CREDIT', 'DEBIT', 'RECONCILIATION', 'REVERSAL');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('PENDING_CUSTOMER', 'MISSED_ATTENDANCE', 'CASH_HANDOVER', 'RECONCILIATION_DIFF', 'TARGET_ALERT', 'GENERAL');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_status" AS ENUM('PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'COLLECTION_AGENT', 'STAFF');--> statement-breakpoint
CREATE TABLE "agent_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"branch_id" uuid,
	"date" date NOT NULL,
	"target_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"target_customers" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "agent_targets_agent_id_date_unique" UNIQUE("agent_id","date")
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"branch_id" uuid,
	"date" date NOT NULL,
	"check_in_at" timestamp with time zone,
	"check_out_at" timestamp with time zone,
	"check_in_gps_lat" numeric(10, 7),
	"check_in_gps_lng" numeric(10, 7),
	"check_in_gps_accuracy" numeric(8, 2),
	"check_out_gps_lat" numeric(10, 7),
	"check_out_gps_lng" numeric(10, 7),
	"check_out_gps_accuracy" numeric(8, 2),
	"total_hours" numeric(4, 2),
	"status" "attendance_status" DEFAULT 'ABSENT' NOT NULL,
	"notes" text,
	"corrected_by" uuid,
	"corrected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "attendance_employee_id_date_unique" UNIQUE("employee_id","date")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_name" text,
	"actor_email" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"before_data" jsonb,
	"after_data" jsonb,
	"ip_address" text,
	"user_agent" text,
	"branch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"address" text,
	"city" text,
	"state" text,
	"phone" text,
	"email" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "branches_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "cashbook_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid,
	"date" date NOT NULL,
	"entry_type" text NOT NULL,
	"payment_mode" "payment_mode",
	"amount" numeric(12, 2) NOT NULL,
	"reference_id" uuid,
	"description" text,
	"running_balance" numeric(12, 2),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_number" text,
	"customer_id" uuid NOT NULL,
	"due_id" uuid,
	"agent_id" uuid NOT NULL,
	"branch_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"payment_mode" "payment_mode" DEFAULT 'CASH' NOT NULL,
	"payment_reference" text,
	"receipt_url" text,
	"notes" text,
	"gps_lat" numeric(10, 7),
	"gps_lng" numeric(10, 7),
	"gps_accuracy" numeric(8, 2),
	"status" "collection_status" DEFAULT 'PENDING' NOT NULL,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"rejected_reason" text,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"idempotency_key" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "collections_collection_number_unique" UNIQUE("collection_number"),
	CONSTRAINT "collections_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_code" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"area" text,
	"city" text,
	"state" text,
	"pincode" text,
	"gps_lat" numeric(10, 7),
	"gps_lng" numeric(10, 7),
	"assigned_agent_id" uuid,
	"branch_id" uuid,
	"opening_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "customers_customer_code_unique" UNIQUE("customer_code")
);
--> statement-breakpoint
CREATE TABLE "dues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"invoice_number" text,
	"reference" text,
	"amount" numeric(12, 2) NOT NULL,
	"outstanding_amount" numeric(12, 2) NOT NULL,
	"due_date" date,
	"status" "due_status" DEFAULT 'OPEN' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "expense_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"branch_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"payment_mode" "payment_mode" DEFAULT 'CASH' NOT NULL,
	"description" text NOT NULL,
	"receipt_url" text,
	"expense_date" date NOT NULL,
	"status" "expense_status" DEFAULT 'PENDING' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "ledger_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"entry_type" "ledger_entry_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"actor_id" uuid NOT NULL,
	"branch_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false,
	"reference_id" uuid,
	"reference_type" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'STAFF' NOT NULL,
	"branch_id" uuid,
	"employee_code" text,
	"department" text,
	"designation" text,
	"joining_date" date,
	"avatar_url" text,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp with time zone,
	"password_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "profiles_email_unique" UNIQUE("email"),
	CONSTRAINT "profiles_employee_code_unique" UNIQUE("employee_code")
);
--> statement-breakpoint
CREATE TABLE "reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"branch_id" uuid,
	"date" date NOT NULL,
	"cash_collected" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cash_submitted" numeric(12, 2) DEFAULT '0' NOT NULL,
	"difference" numeric(12, 2) GENERATED ALWAYS AS (cash_collected - cash_submitted) STORED,
	"status" "reconciliation_status" DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"rejection_reason" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_reconciliations_agent_date" UNIQUE("agent_id","date")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text DEFAULT 'My Company' NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"currency_symbol" text DEFAULT '₹' NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"financial_year_start" integer DEFAULT 4 NOT NULL,
	"logo_url" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "agent_targets" ADD CONSTRAINT "agent_targets_agent_id_profiles_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_targets" ADD CONSTRAINT "agent_targets_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_targets" ADD CONSTRAINT "agent_targets_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_corrected_by_profiles_id_fk" FOREIGN KEY ("corrected_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashbook_entries" ADD CONSTRAINT "cashbook_entries_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashbook_entries" ADD CONSTRAINT "cashbook_entries_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_due_id_dues_id_fk" FOREIGN KEY ("due_id") REFERENCES "public"."dues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_agent_id_profiles_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_confirmed_by_profiles_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_assigned_agent_id_profiles_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues" ADD CONSTRAINT "dues_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dues" ADD CONSTRAINT "dues_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_employee_id_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_profiles_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_actor_id_profiles_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_profiles_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_agent_id_profiles_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_verified_by_profiles_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attendance_employee_date" ON "attendance" USING btree ("employee_id","date");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_collections_agent" ON "collections" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_collections_customer" ON "collections" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_collections_status" ON "collections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_collections_date" ON "collections" USING btree ("collected_at");--> statement-breakpoint
CREATE INDEX "idx_customers_agent" ON "customers" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX "idx_customers_branch" ON "customers" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_dues_customer" ON "dues" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_dues_status" ON "dues" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ledger_entity" ON "ledger_entries" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_actor" ON "ledger_entries" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_ledger_created" ON "ledger_entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient" ON "notifications" USING btree ("recipient_id","is_read");--> statement-breakpoint
CREATE INDEX "idx_reconciliations_agent_date" ON "reconciliations" USING btree ("agent_id","date");