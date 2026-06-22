ALTER TABLE "organization" ADD COLUMN "oversell_policy" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "expiry_policy" text;--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "oversell_policy" text;--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "expiry_policy" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "oversell_policy" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "expiry_policy" text;