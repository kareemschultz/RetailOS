ALTER TABLE "tax_rate" DROP CONSTRAINT "tax_rate_kind_chk";--> statement-breakpoint
UPDATE "tax_rate" SET "kind" = 'standard' WHERE "kind" = 'sales';--> statement-breakpoint
ALTER TABLE "tax_rate" ALTER COLUMN "kind" SET DEFAULT 'standard';--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "tax_rate_id" uuid;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "tax_rate_id" uuid;--> statement-breakpoint
ALTER TABLE "tax_rate" ADD COLUMN "is_inclusive" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_tax_rate_composite_fk" FOREIGN KEY ("tenant_id","tax_rate_id") REFERENCES "public"."tax_rate"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_tax_rate_composite_fk" FOREIGN KEY ("tenant_id","tax_rate_id") REFERENCES "public"."tax_rate"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_rate" ADD CONSTRAINT "tax_rate_kind_chk" CHECK ("tax_rate"."kind" IN ('standard','zero','exempt'));