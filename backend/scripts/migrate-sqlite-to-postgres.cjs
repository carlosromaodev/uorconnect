#!/usr/bin/env node

require("dotenv/config");

const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const postgres = require("postgres");

const tableOrder = [
  "User",
  "Student",
  "AdminAuthorizedStudent",
  "SubmissionConfig",
  "HomeSocialConfig",
  "LiveContentConfig",
  "Speaker",
  "FaqItem",
  "GuideStep",
  "GuideTip",
  "Venue",
  "HomeCourse",
  "Course",
  "PanelTopic",
  "AgendaItem",
  "Submission",
  "Vote",
  "Review",
  "StudentLike",
  "StudentVote",
  "StudentComment",
  "CourseLike",
  "CourseEnrollment",
  "LiveChatMessage"
];

const rawPostgresUrl = process.env.POSTGRES_MIGRATION_URL || process.env.DATABASE_URL;
const sqlitePath = path.resolve(
  process.cwd(),
  process.env.SQLITE_SOURCE_PATH || "./dev.db"
);

if (!rawPostgresUrl) {
  console.error("POSTGRES_MIGRATION_URL ou DATABASE_URL não definido.");
  process.exit(1);
}

if (!/^postgres(ql)?:\/\//i.test(rawPostgresUrl)) {
  console.error("Define um DATABASE_URL/Postgres válido antes de executar a migração.");
  process.exit(1);
}

const postgresUrlObject = new URL(rawPostgresUrl);
postgresUrlObject.searchParams.delete("schema");
const postgresUrl = postgresUrlObject.toString();

if (!fs.existsSync(sqlitePath)) {
  console.error(`Base SQLite não encontrada em ${sqlitePath}.`);
  process.exit(1);
}

const sqlite = new Database(sqlitePath, { readonly: true });
const sql = postgres(postgresUrl, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 30
});

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, "\"\"")}"`;
}

function buildInsertQuery(table, columns, rowCount) {
  const quotedColumns = columns.map(quoteIdentifier).join(", ");
  const placeholders = [];
  let paramIndex = 1;

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const rowPlaceholders = columns.map(() => `$${paramIndex++}`);
    placeholders.push(`(${rowPlaceholders.join(", ")})`);
  }

  return `INSERT INTO ${quoteIdentifier(table)} (${quotedColumns}) VALUES ${placeholders.join(", ")}`;
}

function normalizeValue(column, value) {
  if (value === null || value === undefined) {
    return null;
  }

  const columnType = String(column.type || "").toUpperCase();

  if (columnType === "BOOLEAN") {
    return typeof value === "boolean" ? value : Boolean(value);
  }

  return value;
}

async function truncateTarget(executor) {
  const tablesSql = tableOrder.map(quoteIdentifier).join(", ");
  await executor.unsafe(`TRUNCATE TABLE ${tablesSql} RESTART IDENTITY CASCADE`);
}

async function copyTable(executor, table) {
  const columns = sqlite.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all();
  const columnNames = columns.map((column) => column.name);
  const hasId = columnNames.includes("id");
  const rows = sqlite
    .prepare(
      `SELECT * FROM ${quoteIdentifier(table)}${
        hasId ? ` ORDER BY ${quoteIdentifier("id")}` : ""
      }`
    )
    .all();

  if (rows.length === 0) {
    return { table, rowCount: 0, hasId };
  }

  const chunkSize = 100;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const values = [];

    for (const row of chunk) {
      for (const column of columns) {
        values.push(normalizeValue(column, row[column.name]));
      }
    }

    const query = buildInsertQuery(table, columnNames, chunk.length);
    await executor.unsafe(query, values);
  }

  return { table, rowCount: rows.length, hasId };
}

async function syncSequence(executor, table) {
  await executor.unsafe(
    `SELECT setval(
      pg_get_serial_sequence('${quoteIdentifier(table)}', 'id'),
      COALESCE((SELECT MAX(id) FROM ${quoteIdentifier(table)}), 1),
      COALESCE((SELECT MAX(id) FROM ${quoteIdentifier(table)}) IS NOT NULL, false)
    )`
  );
}

async function main() {
  console.log(`SQLite origem: ${sqlitePath}`);
  console.log(`Postgres destino: ${postgresUrl.replace(/:[^:@/]+@/, ":***@")}`);

  const migrated = await sql.begin(async (tx) => {
    await truncateTarget(tx);

    const results = [];
    for (const table of tableOrder) {
      const result = await copyTable(tx, table);
      results.push(result);
      console.log(`${table}: ${result.rowCount} registo(s) migrado(s)`);
    }

    for (const { table, hasId } of results) {
      if (hasId) {
        await syncSequence(tx, table);
      }
    }

    return results;
  });

  const totalRows = migrated.reduce((sum, item) => sum + item.rowCount, 0);
  console.log(`Migração concluída. ${totalRows} registo(s) copiado(s).`);
}

main()
  .catch((error) => {
    console.error("Falha na migração para Postgres.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    sqlite.close();
    await sql.end({ timeout: 5 });
  });
