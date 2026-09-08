export const DEFAULT_EXPECTED_REPLY = "CACHE-SMOKE-OK";

export function buildStablePrompt(options) {
  if (options.prompt.trim()) {
    return options.prompt.trim();
  }
  const lines = [
    "Prompt cache smoke test.",
    "Read the stable reference below and follow the final instruction exactly.",
    "",
    "Stable reference document begins below.",
  ];
  let index = 1;
  while (lines.join("\n").length < options.promptTargetChars) {
    const label = String(index).padStart(3, "0");
    lines.push(
      `Section ${label}: NextClaw unifies software, services, internet resources, and cloud actions into one intent-first operating layer. ` +
        "This paragraph is intentionally repeated to create a large stable prompt prefix for provider-level prompt-cache verification. " +
        "The content must stay identical across repeated runs so cache-capable providers can reuse the same prefix efficiently.",
    );
    index += 1;
  }
  lines.push("");
  lines.push(`Final instruction source of truth: the assistant must reply exactly ${DEFAULT_EXPECTED_REPLY}.`);
  return lines.join("\n");
}

