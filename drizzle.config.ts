import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next reads .env.local; point drizzle-kit at the same file so there's one source of truth.
config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
