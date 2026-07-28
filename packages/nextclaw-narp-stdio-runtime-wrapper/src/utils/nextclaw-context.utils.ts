export function renderNextclawContextInstructions(
  contextBlocks: ReadonlyArray<string> | undefined,
): string | undefined {
  const instructions = (contextBlocks ?? [])
    .map((block) => block.trim())
    .filter(Boolean)
    .join("\n\n");
  return instructions || undefined;
}
