"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { type AdminCreateFormState } from "./admin-management-state";
import { auth } from "../../auth";
import { safeWriteAuditLog } from "../../lib/audit-log";
import { readDeployStatus, writeUpdateRequest } from "../../lib/system-update";

function ensureSuperAdmin(role: UserRole | undefined) {
  if (role !== UserRole.SUPER_ADMIN) {
    throw new Error("Only super admins can perform this action.");
  }
}

function toActionErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/**
 * SUPER_ADMIN-only: requests an application update. This does NOT pull or
 * rebuild anything itself — the running container cannot. It drops a request
 * file that the host-side updater agent (scripts/host-updater.sh) picks up to
 * run `git pull && docker compose up -d --build`, which restarts the app.
 */
export async function requestSystemUpdateAction(
  _prevState: AdminCreateFormState,
  _formData: FormData,
): Promise<AdminCreateFormState> {
  try {
    const session = await auth();
    ensureSuperAdmin(session?.user?.role);

    const status = await readDeployStatus();
    if (status?.inProgress) {
      return {
        status: "error",
        message: "An update is already in progress. Please wait for it to finish.",
      };
    }

    const requestId = await writeUpdateRequest({
      requestedByUserId: session?.user?.id ?? null,
      requestedByEmail: session?.user?.email ?? null,
    });

    await safeWriteAuditLog({
      actorUserId: session?.user?.id,
      actorRole: session?.user?.role,
      action: "system.update_requested",
      targetType: "System",
      targetId: requestId,
      summary: "Requested application update (git pull + rebuild).",
    });

    revalidatePath("/admin/system");

    return {
      status: "success",
      message:
        "Update started. The app will pull the latest code and restart shortly — this page may briefly become unavailable.",
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error, "Unable to request an update."),
    };
  }
}
