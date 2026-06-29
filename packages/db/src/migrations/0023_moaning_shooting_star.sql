ALTER TABLE "organization" ADD COLUMN "storefront_domain" text;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_storefront_domain_unique" UNIQUE("storefront_domain");