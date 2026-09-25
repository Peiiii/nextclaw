import { Contribution, type NcpTool } from "@nextclaw/harness";
import { BiboSpaceError, BiboSpaceService } from "@/features/bibo-domain/services/bibo-space.service";

function params(value: unknown): Record<string, unknown> {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { return {}; }
  }
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
}

export class BiboSpaceContribution extends Contribution {
  constructor(private readonly space: BiboSpaceService, private readonly sessionId: string) {
    super({ id: "bibo.personal-space" });
  }

  protected setup = (): void => {
    const tool: NcpTool = {
      name: "bibo",
      description: "Read and update the user's Bibo personal space: tasks, calendar, notes, files, and attention inbox. Use help to discover operations by domain or keyword; known actions can be called directly. This is a first-party capability and needs no installation. Never edit Bibo's structured JSON by hand.",
      parameters: {
        type: "object",
        properties: {
          operation: { type: "string", enum: ["help", "call"], description: "help lists usage on demand; call executes a known action." },
          domain: { type: "string", description: "For help: projects, tasks, events, inbox, files, or overview." },
          query: { type: "string", description: "For help: filter relevant operations by keyword." },
          action: { type: "string", description: "For call: operation name, e.g. task.create." },
          input: { type: "object", description: "Action input. Use help for field names and meanings." },
        },
        required: ["operation"],
        additionalProperties: false,
      },
      execute: async (raw: unknown) => {
        const value = params(raw);
        if (value.operation === "help") {
          const actions = this.space.listActions(typeof value.domain === "string" ? value.domain : undefined, typeof value.query === "string" ? value.query : undefined);
          return { ok: true, actions };
        }
        if (value.operation !== "call" || typeof value.action !== "string") return { ok: false, error: "Use operation=help or operation=call with an action." };
        try {
          const result = await this.space.execute(value.action, value.input ?? {}, { kind: "agent", sessionId: this.sessionId });
          return { ok: true, action: value.action, result, persistence: "Saved with the completed Bibo reply." };
        } catch (error) {
          return { ok: false, action: value.action, error: error instanceof BiboSpaceError ? error.message : "Bibo operation failed; do not claim success." };
        }
      },
    };
    this.effect(() => this.kernel.tools.register(tool));
  };
}
