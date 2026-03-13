import test from "node:test";
import assert from "node:assert/strict";

import { mergeMessagesWithFallback } from "../lib/i18n-messages";

test("mergeMessagesWithFallback preserves English values for missing localized keys", () => {
  const merged = mergeMessagesWithFallback(
    {
      Admin: {
        shell: {
          title: "Conference Management",
          sidebar: {
            dashboard: "Dashboard",
            reports: "Reports",
          },
        },
      },
    },
    {
      Admin: {
        shell: {
          sidebar: {
            dashboard: "Panel",
          },
        },
      },
    },
  );

  assert.deepEqual(merged, {
    Admin: {
      shell: {
        title: "Conference Management",
        sidebar: {
          dashboard: "Panel",
          reports: "Reports",
        },
      },
    },
  });
});
