import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({
  path: "../../apps/server/.env",
});

// Migrations connect as `retailos_migrator` (ADR 0006), NOT the runtime
// `retailos_app` role. Falls back to DATABASE_URL only for environments that
// haven't split the URLs yet.
export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL || "",
  },
});
