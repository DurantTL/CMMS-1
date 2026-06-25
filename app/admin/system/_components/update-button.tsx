"use client";

import { useFormState, useFormStatus } from "react-dom";

import { adminCreateInitialState } from "../../../actions/admin-management-state";
import { requestSystemUpdateAction } from "../../../actions/system-update-actions";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Starting update…" : "Update CMMS now"}
    </button>
  );
}

export function UpdateButton({ inProgress }: { inProgress: boolean }) {
  const [state, formAction] = useFormState(requestSystemUpdateAction, adminCreateInitialState);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <input
          name="confirm"
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span>
          I understand this pulls the latest code, rebuilds, and <strong>restarts the app</strong>,
          which briefly disconnects everyone who is currently signed in.
        </span>
      </label>

      {state.status === "error" && state.message ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.message}
        </p>
      ) : null}

      {state.status === "success" && state.message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {state.message}
        </p>
      ) : null}

      <SubmitButton disabled={inProgress} />

      {inProgress ? (
        <p className="text-sm text-slate-600">
          An update is currently in progress. Refresh this page in a minute to see the result.
        </p>
      ) : null}
    </form>
  );
}
