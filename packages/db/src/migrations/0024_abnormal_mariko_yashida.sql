ALTER TABLE "category" ADD COLUMN "is_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "is_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "slug" text;--> statement-breakpoint
CREATE UNIQUE INDEX "product_tenantId_slug_uq" ON "product" USING btree ("tenant_id","slug");