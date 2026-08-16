export function toOpenAiResponsesTools(
  tools: Array<Record<string, unknown>> | undefined,
): Array<Record<string, unknown>> | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }

  return tools.map((tool, index) => {
    if (tool.type !== "function") {
      return tool;
    }

    const functionSpec = tool.function;
    if (!functionSpec || typeof functionSpec !== "object" || Array.isArray(functionSpec)) {
      throw new Error(`Invalid function tool at index ${index}: missing function definition.`);
    }

    const functionRecord = functionSpec as Record<string, unknown>;
    const rawName = functionRecord.name;
    const name = typeof rawName === "string" ? rawName.trim() : "";
    if (!name) {
      throw new Error(`Invalid function tool at index ${index}: missing function name.`);
    }

    const rawDescription = functionRecord.description;
    const rawParameters = functionRecord.parameters;
    const rawStrict = functionRecord.strict;
    return {
      type: "function",
      name,
      parameters:
        rawParameters && typeof rawParameters === "object" && !Array.isArray(rawParameters)
          ? rawParameters
          : { type: "object", properties: {} },
      strict: typeof rawStrict === "boolean" ? rawStrict : null,
      ...(typeof rawDescription === "string" && rawDescription.trim()
        ? { description: rawDescription.trim() }
        : {}),
    };
  });
}
