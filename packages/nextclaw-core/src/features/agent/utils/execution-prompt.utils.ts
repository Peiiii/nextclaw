function normalizeModel(model?: string | null): string {
  return model?.trim().toLowerCase() ?? "";
}

function isOpenAiOrCodexModel(model?: string | null): boolean {
  return /(gpt[-/ ]?5|gpt[-/ ]?4|gpt\b|chatgpt|openai|codex|\bo[134]\b)/i.test(
    normalizeModel(model),
  );
}

function isGoogleModel(model?: string | null): boolean {
  return /(gemini|google)/i.test(normalizeModel(model));
}

function buildSection(title: string, lines: string[]): string {
  return [title, ...lines].join("\n");
}

const TOOL_USE_ENFORCEMENT_LINES = [
  "- When you say you will inspect, run, read, search, edit, or verify something, call the matching tool in the same turn.",
  "- Do not stop at promises like 'I'll check' or 'I will do that' unless the tool call already happened in that turn.",
  "- If the task can still move forward with available tools, continue instead of ending early.",
];

const OPENAI_CODEX_DISCIPLINE_LINES = [
  "- Do not guess time, date, system state, file contents, git state, or other current facts. Check with tools first.",
  "- When the default scope is already clear, act on it before asking an avoidable clarification question.",
  "- If the first tool result is empty or incomplete, retry once with a different strategy before stopping.",
];

const GOOGLE_MODEL_GUIDANCE_LINES = [
  "- Batch independent reads when possible.",
  "- Read the surrounding context before editing files.",
  "- Use explicit file paths and keep the answer focused on results.",
];

export function buildMinimalSystemExecutionPrompt(model?: string | null): string {
  const sections = [
    buildSection("## Tool Use Enforcement", TOOL_USE_ENFORCEMENT_LINES),
  ];

  if (isOpenAiOrCodexModel(model)) {
    sections.push(
      buildSection(
        "## OpenAI/Codex Execution Discipline",
        OPENAI_CODEX_DISCIPLINE_LINES,
      ),
    );
  } else if (isGoogleModel(model)) {
    sections.push(
      buildSection(
        "## Google Model Operational Guidance",
        GOOGLE_MODEL_GUIDANCE_LINES,
      ),
    );
  }

  return sections.join("\n\n");
}

export function buildMinimalRuntimeExecutionPrompt(model?: string | null): string {
  if (!isOpenAiOrCodexModel(model) && !isGoogleModel(model)) {
    return "";
  }

  const lines = [...TOOL_USE_ENFORCEMENT_LINES];
  if (isOpenAiOrCodexModel(model)) {
    lines.push(...OPENAI_CODEX_DISCIPLINE_LINES);
  } else {
    lines.push(...GOOGLE_MODEL_GUIDANCE_LINES);
  }

  return buildSection("## Current Turn Execution", lines);
}
