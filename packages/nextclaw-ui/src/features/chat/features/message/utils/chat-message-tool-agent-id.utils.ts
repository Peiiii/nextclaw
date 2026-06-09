type ToolInvocationAgentIdSource = {
  args?: unknown;
  parsedArgs?: unknown;
  result?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseStructuredValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return value;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readAgentIdFromValue(value: unknown): string | null {
  const parsedValue = parseStructuredValue(value);
  return isRecord(parsedValue) ? readOptionalString(parsedValue.agentId) : null;
}

export function resolveToolInvocationAgentId(
  source: ToolInvocationAgentIdSource,
): string | null {
  return (
    readAgentIdFromValue(source.parsedArgs) ??
    readAgentIdFromValue(source.args) ??
    readAgentIdFromValue(source.result)
  );
}
