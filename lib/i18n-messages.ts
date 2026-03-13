type MessageValue = string | MessageTree;

export type MessageTree = {
  [key: string]: MessageValue;
};

function isMessageTree(value: MessageValue | undefined): value is MessageTree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mergeMessagesWithFallback(fallback: MessageTree, localized: MessageTree): MessageTree {
  const merged: MessageTree = { ...fallback };

  for (const [key, value] of Object.entries(localized)) {
    const fallbackValue = merged[key];

    if (isMessageTree(fallbackValue) && isMessageTree(value)) {
      merged[key] = mergeMessagesWithFallback(fallbackValue, value);
      continue;
    }

    merged[key] = value;
  }

  return merged;
}
