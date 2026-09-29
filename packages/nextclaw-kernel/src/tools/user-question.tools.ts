import { normalizeToolParams } from "@nextclaw/core/tool-base";
import type { NcpTool } from "@nextclaw/ncp";
import type { UserQuestionManager, UserQuestionPrompt } from "@kernel/managers/user-question.manager.js";

export class RequestUserInputAsyncTool implements NcpTool {
  readonly name = "request_user_input_async";
  readonly description = "Ask the user one to three self-contained questions without pausing this run. Prefer short suggested options when there are clear choices; the user can always enter a custom answer. With suggested options, normally choose one sensible default and set recommendedOption to its exact label; omit it only when recommending a choice would mislead the user. Never append '(recommended)' to an option label. Add optionDescriptions only where a brief explanation helps the user understand a choice or tradeoff. Use a separate question for each decision. The call returns after the questions are saved; continue independent work while waiting. An answer arrives later as user input in this session. Do not treat accepted as an answer or approval.";
  readonly parameters = {
    type: "object",
    properties: {
      questions: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "A concise, self-contained question for the user." },
            options: {
              type: "array",
              items: { type: "string" },
              description: "Optional suggested answers. The user may also write a custom answer.",
            },
            recommendedOption: { type: "string", description: "Recommended default; must exactly match one option label. Usually provide this when options are present." },
            optionDescriptions: {
              type: "object",
              additionalProperties: { type: "string" },
              description: "Optional brief explanations keyed by exact option labels. Include only choices that need explanation.",
            },
          },
          required: ["title"],
        },
      },
    },
    required: ["questions"],
  };

  constructor(private readonly questions: Pick<UserQuestionManager, "ask">, private readonly sessionId: string) {}

  execute = async (args: unknown): Promise<{ accepted: true; questionIds: string[] }> => {
    const params = normalizeToolParams(args);
    if (!Array.isArray(params.questions)) throw new Error("questions must be an array.");
    const prompts: UserQuestionPrompt[] = params.questions.map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Each question must be an object.");
      const prompt = value as Record<string, unknown>;
      if (typeof prompt.title !== "string") throw new Error("Question title must be a string.");
      if (prompt.options !== undefined && (!Array.isArray(prompt.options) || !prompt.options.every((option) => typeof option === "string"))) {
        throw new Error("Question options must be strings.");
      }
      if (prompt.recommendedOption !== undefined && typeof prompt.recommendedOption !== "string") {
        throw new Error("Recommended option must be a string.");
      }
      if (prompt.optionDescriptions !== undefined && (!prompt.optionDescriptions || typeof prompt.optionDescriptions !== "object" ||
        Array.isArray(prompt.optionDescriptions) || Object.values(prompt.optionDescriptions).some((description) => typeof description !== "string"))) {
        throw new Error("Option descriptions must map option labels to strings.");
      }
      return { title: prompt.title, ...(prompt.options ? { options: prompt.options as string[] } : {}),
        ...(prompt.recommendedOption !== undefined ? { recommendedOption: prompt.recommendedOption } : {}),
        ...(prompt.optionDescriptions !== undefined ? { optionDescriptions: prompt.optionDescriptions as Record<string, string> } : {}) };
    });
    return await this.questions.ask(this.sessionId, prompts);
  };
}

/** Host-neutral form of the same question tool for runtimes without Node schema compilation. */
export function createPortableRequestUserInputAsyncTool(
  ask: (prompts: readonly UserQuestionPrompt[]) => Promise<{ accepted: true; questionIds: string[] }>,
): NcpTool {
  const native = new RequestUserInputAsyncTool({ ask: async (_sessionId, prompts) => ask(prompts) }, "");
  return {
    name: native.name, description: native.description, modelParameters: native.parameters,
    validateArgs: (value) => value && typeof value === "object" && !Array.isArray(value) &&
      Array.isArray((value as { questions?: unknown }).questions) ? [] : ["questions must be an array"],
    execute: native.execute,
  };
}
