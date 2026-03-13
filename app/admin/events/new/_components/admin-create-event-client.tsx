"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormState } from "react-dom";

import {
  createEventWithDynamicFields,
  saveEventTemplate,
  toggleEventTemplateActive,
} from "../../../../actions/event-admin-actions";
import {
  type CreateEventActionState,
  eventTemplateInitialState,
  type EventTemplateActionState,
} from "../../../../actions/event-admin-state";
import { type EventTemplateDraft } from "../../../../../lib/event-templates";
import {
  DynamicFormBuilder,
  type DynamicFieldDraft,
} from "./dynamic-form-builder";

const STEPS = [
  {
    title: "Event Basics",
    description: "Set event name and start/end dates.",
  },
  {
    title: "Registration & Location",
    description: "Configure registration windows, pricing, and location details.",
  },
  {
    title: "Dynamic Questions",
    description: "Add optional custom form questions for event registrations.",
  },
] as const;

const INITIAL_EVENT_STATE: CreateEventActionState = {
  status: "idle",
  message: null,
};

type AdminCreateEventClientProps = {
  created: boolean;
  selectedTemplateId: string | null;
  templates: EventTemplateDraft[];
};

export function AdminCreateEventClient({
  created,
  selectedTemplateId,
  templates,
}: AdminCreateEventClientProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const [dynamicFields, setDynamicFields] = useState<DynamicFieldDraft[]>(
    selectedTemplate?.snapshot.dynamicFields ?? [],
  );
  const [clientValidationMessage, setClientValidationMessage] = useState<string | null>(null);
  const [formState, formAction] = useFormState(createEventWithDynamicFields, INITIAL_EVENT_STATE);
  const [templateState, templateFormAction] = useFormState<EventTemplateActionState, FormData>(
    saveEventTemplate,
    eventTemplateInitialState,
  );

  const serializedFields = useMemo(() => JSON.stringify(dynamicFields), [dynamicFields]);

  function validateBeforeSubmit() {
    for (const [index, field] of dynamicFields.entries()) {
      if (field.label.trim().length === 0) {
        return `Dynamic field ${index + 1} is missing a label.`;
      }

      if ((field.type === "MULTI_SELECT" || field.type === "SINGLE_SELECT") && field.options.length === 0) {
        return `Dynamic field "${field.label || `#${index + 1}`}" must include at least one option.`;
      }

      if (field.conditionalFieldKey.trim().length > 0 && field.conditionalOperator.length === 0) {
        return `Dynamic field "${field.label || `#${index + 1}`}" is missing a conditional operator.`;
      }

      if (field.conditionalOperator.length > 0 && field.conditionalFieldKey.trim().length === 0) {
        return `Dynamic field "${field.label || `#${index + 1}`}" must select a conditional source field.`;
      }

      if (
        field.conditionalOperator.length > 0 &&
        field.conditionalOperator !== "truthy" &&
        field.conditionalOperator !== "falsy" &&
        field.conditionalValue.trim().length === 0
      ) {
        return `Dynamic field "${field.label || `#${index + 1}`}" is missing a conditional value.`;
      }
    }

    return null;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Super Admin</p>
          <h1 className="text-3xl font-semibold text-slate-900">Create Event</h1>
          <p className="mt-1 text-sm text-slate-600">
            Build a new event in steps, then define dynamic registration questions or start from a reusable template.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/events"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
          >
            Back to Events
          </Link>
          {selectedTemplate ? (
            <Link
              href="/admin/events/new"
              className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
            >
              Clear Template
            </Link>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Event Templates</h2>
            <p className="mt-1 text-sm text-slate-600">
              Templates snapshot the current event wizard fields so future events can reuse the same setup without rebuilding it.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            {templates.length} template{templates.length === 1 ? "" : "s"}
          </p>
        </div>

        {templates.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            No event templates saved yet. Fill out the wizard below and save the draft as your first template.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {templates.map((template) => {
              const isSelected = template.id === selectedTemplateId;

              return (
                <article key={template.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{template.name}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {template.description || "No description"} • {template.snapshot.dynamicFields.length} dynamic field
                        {template.snapshot.dynamicFields.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        template.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {template.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/admin/events/new?template=${template.id}`}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                      }`}
                    >
                      {isSelected ? "Loaded" : "Load Template"}
                    </Link>

                    <form action={toggleEventTemplateActive}>
                      <input type="hidden" name="templateId" value={template.id} />
                      <input type="hidden" name="nextActive" value={template.isActive ? "false" : "true"} />
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900"
                      >
                        {template.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <ol className="grid gap-3 md:grid-cols-3">
          {STEPS.map((step, index) => {
            const isActive = index === currentStep;
            const isComplete = index < currentStep;

            return (
              <li
                key={step.title}
                className={`rounded-xl border p-3 ${
                  isActive
                    ? "border-indigo-300 bg-indigo-50"
                    : isComplete
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-slate-50"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Step {index + 1}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{step.title}</p>
                <p className="mt-1 text-xs text-slate-600">{step.description}</p>
              </li>
            );
          })}
        </ol>
      </div>

      {created ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Event created successfully.
        </p>
      ) : null}

      {selectedTemplate ? (
        <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          Loaded template <span className="font-semibold">{selectedTemplate.name}</span>. All values below are editable before saving a new event.
        </p>
      ) : null}

      {clientValidationMessage ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {clientValidationMessage}
        </p>
      ) : null}

      {formState.status === "error" && formState.message ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {formState.message}
        </p>
      ) : null}

      {templateState.status === "error" && templateState.message ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {templateState.message}
        </p>
      ) : null}

      {templateState.status === "success" && templateState.message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {templateState.message}
        </p>
      ) : null}

      <form
        action={formAction}
        className="space-y-6"
        onSubmit={(event) => {
          const validationError = validateBeforeSubmit();
          setClientValidationMessage(validationError);

          if (validationError) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="dynamicFieldsJson" value={serializedFields} readOnly />
        {selectedTemplate ? <input type="hidden" name="templateId" value={selectedTemplate.id} readOnly /> : null}

        <div
          className={`space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${
            currentStep === 0 ? "" : "hidden"
          }`}
        >
          <h2 className="text-xl font-semibold text-slate-900">Event Basics</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>Event Name</span>
              <input
                name="name"
                type="text"
                required
                defaultValue={selectedTemplate?.snapshot.name ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="2027 Conference Camporee"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>Description (optional)</span>
              <textarea
                name="description"
                rows={3}
                defaultValue={selectedTemplate?.snapshot.description ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Public event description or planning notes"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Starts At</span>
              <input
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={selectedTemplate?.snapshot.startsAt ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Ends At</span>
              <input
                name="endsAt"
                type="datetime-local"
                required
                defaultValue={selectedTemplate?.snapshot.endsAt ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
        </div>

        <div
          className={`space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${
            currentStep === 1 ? "" : "hidden"
          }`}
        >
          <h2 className="text-xl font-semibold text-slate-900">Registration & Location</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span>Registration Opens</span>
              <input
                name="registrationOpensAt"
                type="datetime-local"
                required
                defaultValue={selectedTemplate?.snapshot.registrationOpensAt ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Registration Closes</span>
              <input
                name="registrationClosesAt"
                type="datetime-local"
                required
                defaultValue={selectedTemplate?.snapshot.registrationClosesAt ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Base Price (per attendee)</span>
              <input
                name="basePrice"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={selectedTemplate?.snapshot.basePrice ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="35.00"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Late Fee Price (per attendee)</span>
              <input
                name="lateFeePrice"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={selectedTemplate?.snapshot.lateFeePrice ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="50.00"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
              <span>Late Fee Starts At</span>
              <input
                name="lateFeeStartsAt"
                type="datetime-local"
                required
                defaultValue={selectedTemplate?.snapshot.lateFeeStartsAt ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Location Name</span>
              <input
                name="locationName"
                type="text"
                defaultValue={selectedTemplate?.snapshot.locationName ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Indian Creek Camp"
              />
            </label>

            <label className="space-y-1 text-sm text-slate-700">
              <span>Location Address</span>
              <input
                name="locationAddress"
                type="text"
                defaultValue={selectedTemplate?.snapshot.locationAddress ?? ""}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="1234 Camp Rd, City, ST"
              />
            </label>
          </div>
        </div>

        {currentStep === 2 ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <DynamicFormBuilder fields={dynamicFields} onChange={setDynamicFields} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-slate-900">Save As Template</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Save the current draft as a reusable template. Loaded templates can be updated in place.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-700">
                  <span>Template Name</span>
                  <input
                    name="templateName"
                    type="text"
                    defaultValue={selectedTemplate?.name ?? selectedTemplate?.snapshot.name ?? ""}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="Camporee Base Template"
                  />
                </label>

                <label className="space-y-1 text-sm text-slate-700">
                  <span>Template Description (optional)</span>
                  <input
                    name="templateDescription"
                    type="text"
                    defaultValue={selectedTemplate?.description ?? ""}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="Reusable schedule, pricing, and form setup"
                  />
                </label>

                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 md:col-span-2">
                  <input
                    name="templateIsActive"
                    type="checkbox"
                    defaultChecked={selectedTemplate ? selectedTemplate.isActive : true}
                  />
                  Keep this template active for future event creation
                </label>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>
            {currentStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((step) => Math.min(STEPS.length - 1, step + 1))}
                className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                Next
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {currentStep === 2 ? (
              <button
                type="submit"
                formAction={templateFormAction}
                className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                {selectedTemplate ? "Update Template" : "Save Template"}
              </button>
            ) : null}
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Create Event
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
