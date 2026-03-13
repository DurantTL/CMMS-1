"use client";

import { EventMode } from "@prisma/client";
import { useMemo, useState } from "react";
import { useFormState } from "react-dom";

import { updateEventInitialState } from "../../../../../actions/event-admin-state";
import {
  updateEventDynamicFields,
} from "../../../../../actions/event-admin-actions";
import {
  DynamicFormBuilder,
  type DynamicFieldDraft,
} from "../../../new/_components/dynamic-form-builder";

type EventDynamicFieldsEditorProps = {
  eventId: string;
  eventMode: EventMode;
  eventModeLabel: string;
  eventModeDescription: string;
  initialFields: DynamicFieldDraft[];
  hasResponses: boolean;
};

export function EventDynamicFieldsEditor({
  eventId,
  eventMode,
  eventModeLabel,
  eventModeDescription,
  initialFields,
  hasResponses,
}: EventDynamicFieldsEditorProps) {
  const [fields, setFields] = useState<DynamicFieldDraft[]>(initialFields);
  const [state, formAction] = useFormState(updateEventDynamicFields, updateEventInitialState);

  const serializedFields = useMemo(() => JSON.stringify(fields), [fields]);

  return (
    <form action={formAction} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <input type="hidden" name="eventId" value={eventId} readOnly />
      <input type="hidden" name="dynamicFieldsJson" value={serializedFields} readOnly />

      <div>
        <h2 className="text-xl font-semibold text-slate-900">Edit Dynamic Registration Questions</h2>
        <p className="mt-1 text-sm text-slate-600">
          Update custom registration questions used by club directors for this event.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">{eventModeLabel}</p>
        <p className="mt-1">{eventModeDescription}</p>
        {eventMode === EventMode.BASIC_FORM ? (
          <p className="mt-2 text-xs text-slate-600">
            Keep questions club-scoped for this mode. Attendee-scoped and roster-selection questions are blocked.
          </p>
        ) : eventMode === EventMode.CLASS_ASSIGNMENT ? (
          <p className="mt-2 text-xs text-slate-600">
            This mode supports roster attendees now and class assignment after registration.
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-600">
            This mode supports normal roster attendee selection and dynamic registration prompts.
          </p>
        )}
      </div>

      {hasResponses ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Dynamic questions are locked because registration responses already exist for this event.
        </p>
      ) : null}

      <div className={hasResponses ? "pointer-events-none opacity-60" : ""}>
        <DynamicFormBuilder fields={fields} onChange={setFields} />
      </div>

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

      <button
        type="submit"
        disabled={hasResponses}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save Dynamic Questions
      </button>
    </form>
  );
}
