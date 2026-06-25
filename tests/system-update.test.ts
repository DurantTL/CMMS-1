import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  getRequestsDir,
  getStatusFilePath,
  readDeployStatus,
  writeUpdateRequest,
} from "../lib/system-update";

async function withTempDir(fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), "cmms-deploy-control-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("writeUpdateRequest creates a single JSON request file under requests/", async () => {
  await withTempDir(async (dir) => {
    const id = await writeUpdateRequest({
      requestedByUserId: "user-1",
      requestedByEmail: "admin@example.org",
      baseDir: dir,
    });

    const files = await readdir(getRequestsDir(dir));
    const jsonFiles = files.filter((f) => f.endsWith(".json") && !f.startsWith("."));
    assert.equal(jsonFiles.length, 1);
    assert.equal(jsonFiles[0], `${id}.json`);

    const parsed = JSON.parse(await readFile(path.join(getRequestsDir(dir), `${id}.json`), "utf8"));
    assert.equal(parsed.id, id);
    assert.equal(parsed.requestedByUserId, "user-1");
    assert.equal(parsed.requestedByEmail, "admin@example.org");
    assert.equal(typeof parsed.createdAt, "string");
  });
});

test("readDeployStatus returns null when no status file exists", async () => {
  await withTempDir(async (dir) => {
    assert.equal(await readDeployStatus(dir), null);
  });
});

test("readDeployStatus returns null for malformed JSON", async () => {
  await withTempDir(async (dir) => {
    await writeFile(getStatusFilePath(dir), "{ not json", "utf8");
    assert.equal(await readDeployStatus(dir), null);
  });
});

test("readDeployStatus parses a well-formed status file and derives short SHAs", async () => {
  await withTempDir(async (dir) => {
    await writeFile(
      getStatusFilePath(dir),
      JSON.stringify({
        currentCommit: "abcdef1234567890",
        remoteCommit: "abcdef1234567890",
        updateAvailable: false,
        lastCheckedAt: "2026-06-25T00:00:00.000Z",
        inProgress: false,
        lastUpdate: { status: "success", at: "2026-06-24T00:00:00.000Z", requestedByEmail: "a@b.org" },
      }),
      "utf8",
    );

    const status = await readDeployStatus(dir);
    assert.ok(status);
    assert.equal(status.currentCommitShort, "abcdef1");
    assert.equal(status.remoteCommitShort, "abcdef1");
    assert.equal(status.updateAvailable, false);
    assert.equal(status.inProgress, false);
    assert.deepEqual(status.lastUpdate, {
      status: "success",
      at: "2026-06-24T00:00:00.000Z",
      requestedByEmail: "a@b.org",
    });
  });
});

test("readDeployStatus infers updateAvailable when current and remote commits differ", async () => {
  await withTempDir(async (dir) => {
    await writeFile(
      getStatusFilePath(dir),
      JSON.stringify({
        currentCommit: "1111111aaaaaaa",
        remoteCommit: "2222222bbbbbbb",
        inProgress: false,
      }),
      "utf8",
    );

    const status = await readDeployStatus(dir);
    assert.ok(status);
    assert.equal(status.updateAvailable, true);
  });
});

test("readDeployStatus drops a malformed lastUpdate block", async () => {
  await withTempDir(async (dir) => {
    await mkdir(dir, { recursive: true });
    await writeFile(
      getStatusFilePath(dir),
      JSON.stringify({
        currentCommit: "abc",
        remoteCommit: "abc",
        inProgress: false,
        lastUpdate: { status: "weird", at: "" },
      }),
      "utf8",
    );

    const status = await readDeployStatus(dir);
    assert.ok(status);
    assert.equal(status.lastUpdate, null);
  });
});
