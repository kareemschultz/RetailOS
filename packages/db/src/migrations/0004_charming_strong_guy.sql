ALTER TABLE "product" ALTER COLUMN "price_minor" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "invoice" ALTER COLUMN "total_minor" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "sale" ALTER COLUMN "total_minor" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "sale_line" ALTER COLUMN "unit_price_minor" SET DATA TYPE bigint;