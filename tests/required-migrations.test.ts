import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { REQUIRED_MIGRATION_NAMES } from "../lib/required-migrations";

test("required migration list matches migration directories checked into the repo", () => {
  const migrationsDirectory = path.join(process.cwd(), "prisma", "migrations");
  const migrationNames = readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual([...REQUIRED_MIGRATION_NAMES].sort(), migrationNames);
});
