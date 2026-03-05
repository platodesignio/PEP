#!/usr/bin/env node
/**
 * Build script that handles optional DATABASE_URL.
 * - Always runs: prisma generate, next build
 * - Conditionally runs: prisma migrate deploy (only when real DATABASE_URL is set)
 */
"use strict";
const { execSync } = require("child_process");

const DUMMY_URL = "postgresql://localhost/dummy";
const hasRealDb =
  process.env.DATABASE_URL && process.env.DATABASE_URL !== DUMMY_URL;

// Ensure prisma generate always has a DATABASE_URL for schema validation
const env = { ...process.env, DATABASE_URL: process.env.DATABASE_URL || DUMMY_URL };

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", env });
}

run("prisma generate");
if (hasRealDb) {
  run("prisma migrate deploy");
} else {
  console.log("Skipping prisma migrate deploy (no real DATABASE_URL set)");
}
run("next build");
