import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeAuditMetadata } from "../lib/audit-log";

test("audit metadata strips secrets and medical fields before persistence", () => {
  const sanitized = sanitizeAuditMetadata({
    userId: "user-1",
    password: "do-not-log",
    medicalFlags: "sensitive",
    insurancePolicyNumber: "sensitive",
    sendInviteEmail: true,
    count: 2,
  });

  assert.deepEqual(sanitized, {
    userId: "user-1",
    sendInviteEmail: true,
    count: 2,
  });
});
