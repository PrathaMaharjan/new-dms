import { defineConfig } from "drizzle-kit";

if (!process.env.DIRECT_DATABASE_URL) {
  throw new Error("DIRECT_DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations run against the direct (unpooled) connection, not the pooler.
    url: process.env.DIRECT_DATABASE_URL,
  },
  strict: true,
  verbose: true,
});