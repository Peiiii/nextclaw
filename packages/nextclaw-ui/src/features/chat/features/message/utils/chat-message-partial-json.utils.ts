export type PartialJsonStringValue = {
  value: string;
  truncated: boolean;
};

function decodeJsonStringChar(value: string): string {
  switch (value) {
    case '"':
    case "\\":
    case "/":
      return value;
    case "b":
      return "\b";
    case "f":
      return "\f";
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    default:
      return value;
  }
}

function locatePartialJsonStringValueStart(raw: string, fieldName: string): number | null {
  const marker = `"${fieldName}"`;
  const markerIndex = raw.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }
  const colonIndex = raw.indexOf(":", markerIndex + marker.length);
  if (colonIndex < 0) {
    return null;
  }
  let valueStart = colonIndex + 1;
  while (valueStart < raw.length && /\s/.test(raw[valueStart] ?? "")) {
    valueStart += 1;
  }
  return raw[valueStart] === '"' ? valueStart + 1 : null;
}

function consumePartialJsonStringValue(
  raw: string,
  valueStart: number,
  maxChars = Number.POSITIVE_INFINITY,
): PartialJsonStringValue | null {
  let output = "";
  let escaped = false;
  for (let index = valueStart; index < raw.length; index += 1) {
    const current = raw[index];
    if (current == null) {
      break;
    }
    if (escaped) {
      output += decodeJsonStringChar(current);
      escaped = false;
      continue;
    }
    if (current === "\\") {
      escaped = true;
      continue;
    }
    if (current === '"') {
      return { value: output, truncated: false };
    }
    output += current;
    if (output.length >= maxChars) {
      return { value: output, truncated: true };
    }
  }
  return output.length > 0 ? { value: output, truncated: false } : null;
}

export function readPartialJsonStringField(
  raw: string,
  fieldNames: readonly string[],
  maxChars = Number.POSITIVE_INFINITY,
): PartialJsonStringValue | null {
  for (const fieldName of fieldNames) {
    const valueStart = locatePartialJsonStringValueStart(raw, fieldName);
    if (valueStart == null) {
      continue;
    }
    return consumePartialJsonStringValue(raw, valueStart, maxChars);
  }
  return null;
}
