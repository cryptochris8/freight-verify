ALTER TABLE "loads" ADD COLUMN "driver_token" varchar(64);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "digest_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "digest_recipient_emails" text[];--> statement-breakpoint
ALTER TABLE "pickup_verifications" ADD COLUMN "sms_status" varchar(20);--> statement-breakpoint
ALTER TABLE "pickup_verifications" ADD COLUMN "sms_error" text;--> statement-breakpoint
ALTER TABLE "loads" ADD CONSTRAINT "loads_driver_token_unique" UNIQUE("driver_token");