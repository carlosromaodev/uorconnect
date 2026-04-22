import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Keep local development working even when .env is absent.
const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
process.env.DATABASE_URL = databaseUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts"
  },
  datasource: {
    url: env("DATABASE_URL")
  }
});
