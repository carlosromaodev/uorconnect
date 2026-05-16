#!/usr/bin/env node

require("dotenv/config");

const { spawnSync } = require("node:child_process");

const provider = process.env.DATABASE_PROVIDER === "postgres"
  ? "postgresql"
  : process.env.DATABASE_PROVIDER || "sqlite";
const isPostgres = provider === "postgresql";
const command = process.platform === "win32" ? "npx.cmd" : "npx";
const args = isPostgres
  ? ["prisma", "db", "push", "--schema", "prisma/schema.deploy.prisma"]
  : ["prisma", "db", "push"];

if (isPostgres) {
  const prepared = spawnSync(
    process.execPath,
    ["scripts/prepare-prisma-schema.mjs", "postgresql", "prisma/schema.deploy.prisma"],
    { stdio: "inherit" }
  );

  if (prepared.status !== 0) {
    process.exit(prepared.status ?? 1);
  }
}

const result = spawnSync(command, args, { stdio: "inherit" });
process.exit(result.status ?? 1);
