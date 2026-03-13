import { EventMode, FormFieldScope, FormFieldType } from "@prisma/client";

type EventModeConfig = {
  label: string;
  description: string;
  allowsRosterAttendees: boolean;
  allowsAttendeeScopedFields: boolean;
  allowsRosterScopedQuestions: boolean;
  supportsClassAssignment: boolean;
};

const EVENT_MODE_CONFIG: Record<EventMode, EventModeConfig> = {
  [EventMode.BASIC_FORM]: {
    label: "Basic Form",
    description: "Club-level event registration with no roster attendee selection or class assignment.",
    allowsRosterAttendees: false,
    allowsAttendeeScopedFields: false,
    allowsRosterScopedQuestions: false,
    supportsClassAssignment: false,
  },
  [EventMode.CLUB_REGISTRATION]: {
    label: "Club Registration",
    description: "Standard club registration with roster attendee selection and dynamic registration questions.",
    allowsRosterAttendees: true,
    allowsAttendeeScopedFields: true,
    allowsRosterScopedQuestions: true,
    supportsClassAssignment: false,
  },
  [EventMode.CLASS_ASSIGNMENT]: {
    label: "Class Assignment",
    description: "Club registration plus roster attendee selection and follow-on class assignment workflows.",
    allowsRosterAttendees: true,
    allowsAttendeeScopedFields: true,
    allowsRosterScopedQuestions: true,
    supportsClassAssignment: true,
  },
};

export function getEventModeConfig(mode: EventMode) {
  return EVENT_MODE_CONFIG[mode];
}

export function getAllEventModes() {
  return Object.values(EventMode).map((mode) => ({
    value: mode,
    ...getEventModeConfig(mode),
  }));
}

export function parseEventMode(rawValue: string | null | undefined): EventMode {
  if (rawValue && Object.values(EventMode).includes(rawValue as EventMode)) {
    return rawValue as EventMode;
  }

  return EventMode.CLUB_REGISTRATION;
}

type ModeValidationField = {
  key: string;
  label: string;
  type: FormFieldType;
  fieldScope: FormFieldScope;
};

export function validateDynamicFieldsForEventMode(
  mode: EventMode,
  dynamicFields: ModeValidationField[],
) {
  const config = getEventModeConfig(mode);

  if (config.allowsAttendeeScopedFields && config.allowsRosterScopedQuestions) {
    return;
  }

  for (const field of dynamicFields) {
    if (!config.allowsAttendeeScopedFields && field.fieldScope === FormFieldScope.ATTENDEE) {
      throw new Error(`"${field.label}" cannot be attendee-scoped for a ${config.label} event.`);
    }

    if (
      !config.allowsRosterScopedQuestions &&
      (field.type === FormFieldType.ROSTER_SELECT || field.type === FormFieldType.ROSTER_MULTI_SELECT)
    ) {
      throw new Error(`"${field.label}" cannot use roster selections for a ${config.label} event.`);
    }
  }
}
