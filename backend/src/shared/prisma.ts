import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const databaseProvider = process.env.DATABASE_PROVIDER ?? "sqlite";
const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";

process.env.DATABASE_PROVIDER = databaseProvider;
process.env.DATABASE_URL = databaseUrl;

export const prisma = databaseProvider === "sqlite"
  ? new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) })
  : new PrismaClient({
    adapter: new PrismaPg(new Pool({ connectionString: databaseUrl }))
  });
