CREATE TYPE "public"."actor_type" AS ENUM('user', 'carrier', 'driver', 'system');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('open', 'acknowledged', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."carrier_status" AS ENUM('pending', 'verified', 'flagged', 'suspended', 'expired');--> statement-breakpoint
CREATE TYPE "public"."check_type" AS ENUM('fmcsa_lookup', 'insurance_verify', 'document_review', 'manual');--> statement-breakpoint
CREATE TYPE "public"."doc_type" AS ENUM('insurance_cert', 'operating_authority', 'w9', 'other');--> statement-breakpoint
CREATE TYPE "public"."load_doc_type" AS ENUM('bol', 'rate_confirmation', 'pod', 'other');--> statement-breakpoint
CREATE TYPE "public"."load_status" AS ENUM('draft', 'tendered', 'accepted', 'in_transit', 'delivered', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."message_author_type" AS ENUM('user', 'carrier', 'system');--> statement-breakpoint
CREATE TYPE "public"."pickup_verification_status" AS ENUM('pending', 'verified', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."plan_tier" AS ENUM('starter', 'professional', 'business');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'unpaid');--> statement-breakpoint
CREATE TYPE "public"."verification_status_enum" AS ENUM('passed', 'failed', 'pending', 'expired');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"load_id" uuid,
	"carrier_id" uuid,
	"alert_type" varchar(50) NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"status" "alert_status" DEFAULT 'open',
	"acknowledged_by" text,
	"acknowledged_at" timestamp with time zone,
	"acknowledge_note" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"org_id" uuid,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"action" varchar(50),
	"actor_id" text,
	"actor_type" "actor_type",
	"metadata" jsonb,
	"ip_address" "inet",
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "carrier_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"doc_type" "doc_type" NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer,
	"uploaded_by" text,
	"verified" boolean DEFAULT false,
	"verified_by" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "carrier_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"carrier_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"check_type" "check_type" NOT NULL,
	"status" "verification_status_enum" DEFAULT 'pending',
	"details" jsonb,
	"performed_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "carriers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"dot_number" varchar(10) NOT NULL,
	"mc_number" varchar(10),
	"legal_name" text,
	"dba_name" text,
	"address" jsonb,
	"phone" varchar(20),
	"email" varchar(255),
	"status" "carrier_status" DEFAULT 'pending',
	"fmcsa_snapshot" jsonb,
	"fmcsa_last_check" timestamp with time zone,
	"safety_rating" varchar(20),
	"insurance_on_file" boolean,
	"fleet_size" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "load_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"doc_type" "load_doc_type" NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "load_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"load_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"actor_id" text,
	"actor_type" "actor_type",
	"description" text,
	"metadata" jsonb,
	"geo_lat" numeric(10, 7),
	"geo_lng" numeric(10, 7),
	"ip_address" "inet",
	"prev_hash" varchar(64),
	"event_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "load_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"author_id" text,
	"author_name" text,
	"author_type" "message_author_type" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"reference_number" varchar(50),
	"carrier_id" uuid,
	"status" "load_status" DEFAULT 'draft',
	"origin_name" text,
	"origin_address" text,
	"origin_lat" numeric(10, 7),
	"origin_lng" numeric(10, 7),
	"destination_name" text,
	"destination_address" text,
	"destination_lat" numeric(10, 7),
	"destination_lng" numeric(10, 7),
	"pickup_date" timestamp with time zone,
	"delivery_date" timestamp with time zone,
	"commodity" text,
	"weight_lbs" integer,
	"special_instructions" text,
	"rate_cents" integer,
	"tender_token" varchar(64),
	"tender_expires_at" timestamp with time zone,
	"metadata" jsonb,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"completed_steps" jsonb DEFAULT '[]'::jsonb,
	"is_complete" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "onboarding_progress_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_org_id" text NOT NULL,
	"name" text NOT NULL,
	"stripe_customer_id" text,
	"plan" text DEFAULT 'starter',
	"verified_loads_limit" integer DEFAULT 50,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "organizations_clerk_org_id_unique" UNIQUE("clerk_org_id")
);
--> statement-breakpoint
CREATE TABLE "pickup_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"load_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"otp_hash" varchar(255),
	"otp_expires_at" timestamp with time zone,
	"otp_attempts" integer DEFAULT 0,
	"driver_name" text,
	"driver_phone" varchar(20),
	"truck_number" text,
	"trailer_number" text,
	"verification_status" "pickup_verification_status" DEFAULT 'pending',
	"verified_at" timestamp with time zone,
	"verified_by" text,
	"photo_urls" text[],
	"geo_lat" numeric(10, 7),
	"geo_lng" numeric(10, 7),
	"geo_timestamp" timestamp with time zone,
	"geo_accuracy" numeric(8, 2),
	"ip_address" "inet",
	"user_agent" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "stripe_webhook_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"stripe_price_id" text,
	"plan_tier" "plan_tier" DEFAULT 'starter' NOT NULL,
	"status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "subscriptions_org_id_unique" UNIQUE("org_id"),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_documents" ADD CONSTRAINT "carrier_documents_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_documents" ADD CONSTRAINT "carrier_documents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_verifications" ADD CONSTRAINT "carrier_verifications_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_verifications" ADD CONSTRAINT "carrier_verifications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carriers" ADD CONSTRAINT "carriers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_documents" ADD CONSTRAINT "load_documents_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_documents" ADD CONSTRAINT "load_documents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_events" ADD CONSTRAINT "load_events_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_events" ADD CONSTRAINT "load_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_messages" ADD CONSTRAINT "load_messages_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_messages" ADD CONSTRAINT "load_messages_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loads" ADD CONSTRAINT "loads_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loads" ADD CONSTRAINT "loads_carrier_id_carriers_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."carriers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_verifications" ADD CONSTRAINT "pickup_verifications_load_id_loads_id_fk" FOREIGN KEY ("load_id") REFERENCES "public"."loads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_verifications" ADD CONSTRAINT "pickup_verifications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_org_id_idx" ON "alerts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "alerts_org_id_status_idx" ON "alerts" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "alerts_severity_idx" ON "alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "alerts_created_at_idx" ON "alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_org_id_idx" ON "audit_log" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "carrier_documents_carrier_id_idx" ON "carrier_documents" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "carrier_documents_org_id_idx" ON "carrier_documents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "carrier_documents_expires_at_idx" ON "carrier_documents" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "carrier_verifications_carrier_id_idx" ON "carrier_verifications" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "carrier_verifications_org_id_idx" ON "carrier_verifications" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "carriers_org_id_idx" ON "carriers" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "carriers_dot_number_idx" ON "carriers" USING btree ("dot_number");--> statement-breakpoint
CREATE INDEX "carriers_status_idx" ON "carriers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "carriers_org_id_status_idx" ON "carriers" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "load_documents_load_id_idx" ON "load_documents" USING btree ("load_id");--> statement-breakpoint
CREATE INDEX "load_documents_org_id_idx" ON "load_documents" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "load_events_load_id_idx" ON "load_events" USING btree ("load_id");--> statement-breakpoint
CREATE INDEX "load_events_org_id_idx" ON "load_events" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "load_events_event_type_idx" ON "load_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "load_events_created_at_idx" ON "load_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "load_messages_load_id_idx" ON "load_messages" USING btree ("load_id");--> statement-breakpoint
CREATE INDEX "load_messages_org_id_idx" ON "load_messages" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "loads_org_id_idx" ON "loads" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "loads_carrier_id_idx" ON "loads" USING btree ("carrier_id");--> statement-breakpoint
CREATE INDEX "loads_status_idx" ON "loads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "loads_org_id_status_idx" ON "loads" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "loads_pickup_date_idx" ON "loads" USING btree ("pickup_date");--> statement-breakpoint
CREATE INDEX "loads_reference_number_idx" ON "loads" USING btree ("reference_number");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_clerk_org_id_idx" ON "organizations" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "pickup_verifications_load_id_idx" ON "pickup_verifications" USING btree ("load_id");--> statement-breakpoint
CREATE INDEX "pickup_verifications_org_id_idx" ON "pickup_verifications" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "pickup_verifications_verification_status_idx" ON "pickup_verifications" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "subscriptions_stripe_customer_id_idx" ON "subscriptions" USING btree ("stripe_customer_id");