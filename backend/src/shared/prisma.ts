import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function normalizeDatabaseProvider(value?: string) {
  return value === "postgres" ? "postgresql" : value ?? "sqlite";
}

const databaseProvider = normalizeDatabaseProvider(process.env.DATABASE_PROVIDER);
const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && databaseProvider !== "postgresql") {
  throw new Error("Production must run with DATABASE_PROVIDER=postgresql");
}

if (isProduction && !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  throw new Error("Production must use a PostgreSQL DATABASE_URL");
}

process.env.DATABASE_PROVIDER = databaseProvider;
process.env.DATABASE_URL = databaseUrl;

export const prisma = databaseProvider === "sqlite"
  ? new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
  : new PrismaClient({
    adapter: new PrismaPg(new Pool({
      connectionString: databaseUrl,
      max: Number(process.env.PGPOOL_MAX ?? 20),
      min: Number(process.env.PGPOOL_MIN ?? 2),
      idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_TIMEOUT_MS ?? 30_000),
      connectionTimeoutMillis: Number(process.env.PGPOOL_CONNECT_TIMEOUT_MS ?? 8_000),
    }))
  });
