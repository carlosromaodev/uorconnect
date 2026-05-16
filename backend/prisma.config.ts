import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Keep local development working even when .env is absent.
function normalizeDatabaseProvider(value?: string) {
  return value === "postgres" ? "postgresql" : value ?? "sqlite";
}

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const databaseProvider = normalizeDatabaseProvider(process.env.DATABASE_PROVIDER);
process.env.DATABASE_URL = databaseUrl;
process.env.DATABASE_PROVIDER = databaseProvider;

export default defineConfig({
  schema: databaseProvider === "postgresql" ? "prisma/schema.deploy.prisma" : "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts"
  },
  datasource: {
    url: env("DATABASE_URL")
  }
});
