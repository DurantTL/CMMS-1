import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Shared helpers for the in-app "Update CMMS" button.
 *
 * The webapp runs as an immutable Docker image: it has no `.git`, no source
 * tree, and no build toolchain. It therefore CANNOT update itself. Instead, the
 * SUPER_ADMIN button drops a request file into a shared volume
 * (`/app/deploy-control` by default) and a privileged host-side agent (see
 * `scripts/host-updater.sh`) performs the real `git pull && docker compose up
 * -d --build`, writing results back into `status.json`.
 *
 * This module only does plain file IO — no `child_process`, no git, no docker.
 */

export const DEPLOY_CONTROL_DIR =
  process.env.DEPLOY_CONTROL_DIR ?? "/app/deploy-control";

export function getRequestsDir(baseDir: string = DEPLOY_CONTROL_DIR) {
  return path.join(baseDir, "requests");
}

export function getStatusFilePath(baseDir: string = DEPLOY_CONTROL_DIR) {
  return path.join(baseDir, "status.json");
}

export type UpdateRequest = {
  id: string;
  createdAt: string;
  requestedByUserId: string | null;
  requestedByEmail: string | null;
};

export type DeployStatus = {
  currentCommit: string | null;
  currentCommitShort: string | null;
  remoteCommit: string | null;
  remoteCommitShort: string | null;
  updateAvailable: boolean;
  lastCheckedAt: string | null;
  inProgress: boolean;
  lastUpdate: {
    status: "success" | "error";
    at: string;
    requestedByEmail: string | null;
  } | null;
};

type WriteUpdateRequestInput = {
  requestedByUserId?: string | null;
  requestedByEmail?: string | null;
  baseDir?: string;
};

/**
 * Atomically writes an update-request file into `requests/<uuid>.json`.
 * Atomic = temp file + rename, so the host agent never reads a half-written file.
 * Returns the generated request id.
 */
export async function writeUpdateRequest({
  requestedByUserId = null,
  requestedByEmail = null,
  baseDir = DEPLOY_CONTROL_DIR,
}: WriteUpdateRequestInput = {}): Promise<string> {
  const id = randomUUID();
  const request: UpdateRequest = {
    id,
    createdAt: new Date().toISOString(),
    requestedByUserId,
    requestedByEmail,
  };

  const requestsDir = getRequestsDir(baseDir);
  await mkdir(requestsDir, { recursive: true });

  const finalPath = path.join(requestsDir, `${id}.json`);
  const tempPath = path.join(requestsDir, `.${id}.json.tmp`);
  await writeFile(tempPath, `${JSON.stringify(request, null, 2)}\n`, "utf8");
  await rename(tempPath, finalPath);

  return id;
}

function shortSha(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value.trim().slice(0, 7);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Reads and normalizes `status.json` written by the host agent.
 * Tolerates a missing or malformed file by returning `null`, so the page can
 * render gracefully before the agent has ever run.
 */
export async function readDeployStatus(
  baseDir: string = DEPLOY_CONTROL_DIR,
): Promise<DeployStatus | null> {
  let raw: string;
  try {
    raw = await readFile(getStatusFilePath(baseDir), "utf8");
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const currentCommit = asString(record.currentCommit);
  const remoteCommit = asString(record.remoteCommit);

  let lastUpdate: DeployStatus["lastUpdate"] = null;
  const rawLastUpdate = record.lastUpdate;
  if (rawLastUpdate && typeof rawLastUpdate === "object" && !Array.isArray(rawLastUpdate)) {
    const lu = rawLastUpdate as Record<string, unknown>;
    const status = lu.status === "success" || lu.status === "error" ? lu.status : null;
    const at = asString(lu.at);
    if (status && at) {
      lastUpdate = {
        status,
        at,
        requestedByEmail: asString(lu.requestedByEmail),
      };
    }
  }

  return {
    currentCommit,
    currentCommitShort: shortSha(currentCommit),
    remoteCommit,
    remoteCommitShort: shortSha(remoteCommit),
    updateAvailable:
      record.updateAvailable === true ||
      (currentCommit !== null && remoteCommit !== null && currentCommit !== remoteCommit),
    lastCheckedAt: asString(record.lastCheckedAt),
    inProgress: record.inProgress === true,
    lastUpdate,
  };
}
