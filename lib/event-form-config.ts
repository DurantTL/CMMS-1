import { type Prisma } from "@prisma/client";

export type EventFieldConditionalOperator =
  | "equals"
  | "not_equals"
  | "includes"
  | "not_includes"
  | "truthy"
  | "falsy";

export type EventFieldConditionalRule = {
  fieldKey: string;
  operator: EventFieldConditionalOperator;
  value?: string;
};

export type EventFieldConfig = {
  optionValues: string[];
  conditional: EventFieldConditionalRule | null;
};

const CONDITIONAL_OPERATORS = new Set<EventFieldConditionalOperator>([
  "equals",
  "not_equals",
  "includes",
  "not_includes",
  "truthy",
  "falsy",
]);

function hasValue(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function parseConditionalRule(value: unknown): EventFieldConditionalRule | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const fieldKey = typeof candidate.fieldKey === "string" ? candidate.fieldKey.trim() : "";
  const operator =
    typeof candidate.operator === "string" && CONDITIONAL_OPERATORS.has(candidate.operator as EventFieldConditionalOperator)
      ? (candidate.operator as EventFieldConditionalOperator)
      : null;

  if (fieldKey.length === 0 || !operator) {
    return null;
  }

  const rawValue = candidate.value;

  return {
    fieldKey,
    operator,
    value:
      typeof rawValue === "string"
        ? rawValue
        : typeof rawValue === "number" || typeof rawValue === "boolean"
          ? String(rawValue)
          : undefined,
  };
}

function normalizeScalar(value: unknown) {
  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).toLowerCase();
  }

  return "";
}

export function readEventFieldConfig(options: unknown): EventFieldConfig {
  if (Array.isArray(options)) {
    return {
      optionValues: normalizeStringArray(options),
      conditional: null,
    };
  }

  if (!options || typeof options !== "object") {
    return {
      optionValues: [],
      conditional: null,
    };
  }

  const candidate = options as Record<string, unknown>;

  return {
    optionValues: normalizeStringArray(candidate.choices ?? candidate.options),
    conditional: parseConditionalRule(candidate.conditional),
  };
}

export function buildStoredEventFieldOptions(input: EventFieldConfig): Prisma.InputJsonValue | null {
  const optionValues = normalizeStringArray(input.optionValues);
  const conditional =
    input.conditional && input.conditional.fieldKey.trim().length > 0
      ? {
          fieldKey: input.conditional.fieldKey.trim(),
          operator: input.conditional.operator,
          ...(typeof input.conditional.value === "string" && input.conditional.value.length > 0
            ? { value: input.conditional.value }
            : {}),
        }
      : null;

  if (!conditional) {
    return optionValues.length > 0 ? optionValues : null;
  }

  return {
    ...(optionValues.length > 0 ? { choices: optionValues } : {}),
    conditional,
  };
}

export function isEventFieldVisible(
  field: { options: unknown },
  responsesByFieldKey: Record<string, unknown>,
) {
  const conditional = readEventFieldConfig(field.options).conditional;

  if (!conditional) {
    return true;
  }

  const sourceValue = responsesByFieldKey[conditional.fieldKey];

  if (conditional.operator === "truthy") {
    return hasValue(sourceValue);
  }

  if (conditional.operator === "falsy") {
    return !hasValue(sourceValue);
  }

  if (conditional.operator === "includes" || conditional.operator === "not_includes") {
    const matches = Array.isArray(sourceValue)
      ? sourceValue.some((entry) => normalizeScalar(entry) === normalizeScalar(conditional.value ?? ""))
      : normalizeScalar(sourceValue).includes(normalizeScalar(conditional.value ?? ""));

    return conditional.operator === "includes" ? matches : !matches;
  }

  const matches = normalizeScalar(sourceValue) === normalizeScalar(conditional.value ?? "");
  return conditional.operator === "equals" ? matches : !matches;
}
