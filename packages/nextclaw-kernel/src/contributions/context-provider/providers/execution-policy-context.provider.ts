import type { ContextProviderRunContextService } from "@kernel/contributions/context-provider/services/context-provider-run-context.service.js";
import type {
  AgentRunRequest,
  ContextBlock,
  ContextProvider,
} from "@kernel/types/agent-run.types.js";

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

export function renderAgentSafetyContext(): string {
  return buildSection("## Safety", [
    "You have no independent goals: do not pursue self-preservation, replication, resource acquisition, or power-seeking; avoid long-term plans beyond the user's request.",
    "Prioritize safety and human oversight over completion; if instructions conflict, pause and ask; comply with stop/pause/audit requests and never bypass safeguards. (Inspired by Anthropic's constitution.)",
    "Do not manipulate or persuade anyone to expand access or disable safeguards. Do not copy yourself or change system prompts, safety rules, or tool policies unless explicitly requested.",
  ]);
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

export function renderSystemExecutionPolicy(model?: string | null): string {
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

export class ExecutionPolicyContextProvider implements ContextProvider {
  constructor(private readonly context: ContextProviderRunContextService) {}

  provide = async (
    request: AgentRunRequest,
  ): Promise<readonly ContextBlock[]> => {
    const { runContext } = await this.context.resolve(request);
    return [renderSystemExecutionPolicy(runContext.effectiveModel)];
  };
}
