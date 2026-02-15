import { Tool } from "./base.js";
import type { SubagentManager } from "../subagent.js";

export class SubagentsTool extends Tool {
  constructor(private manager: SubagentManager) {
    super();
  }

  get name(): string {
    return "subagents";
  }

  get description(): string {
    return "Manage running subagents (list/steer/kill)";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "kill", "steer"],
          description: "Action to perform"
        },
        target: { type: "string", description: "Subagent target (id/label/last/index)" },
        message: { type: "string", description: "Steer instruction for a running subagent" },
        recentMinutes: { type: "number", description: "Only list recent runs" },
        id: { type: "string", description: "Alias for target" },
        note: { type: "string", description: "Alias for message" }
      },
      required: ["action"]
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const action = String(params.action ?? "");
    if (action === "list") {
      const recentMinutes =
        typeof params.recentMinutes === "number" && Number.isFinite(params.recentMinutes)
          ? Math.max(1, Math.floor(params.recentMinutes))
          : null;
      const runs = this.manager.listRuns();
      const now = Date.now();
      const filtered = recentMinutes
        ? runs.filter((run) => {
            const startedAt = Date.parse(run.startedAt);
            const doneAt = run.doneAt ? Date.parse(run.doneAt) : NaN;
            const ts = Number.isFinite(doneAt) ? doneAt : startedAt;
            return Number.isFinite(ts) && now - ts <= recentMinutes * 60 * 1000;
          })
        : runs;
      return JSON.stringify({ runs: filtered }, null, 2);
    }
    if (action === "kill") {
      const target = String(params.target ?? params.id ?? "").trim();
      if (!target) {
        return "Error: target is required for kill";
      }
      const resolved = resolveTarget(target, this.manager.listRuns());
      if (!resolved) {
        return `Error: subagent not found (${target})`;
      }
      const ok = this.manager.cancelRun(resolved.id);
      return ok ? `Subagent ${resolved.id} killed` : `Subagent ${resolved.id} not found`;
    }
    if (action === "steer") {
      const target = String(params.target ?? params.id ?? "").trim();
      const note = String(params.message ?? params.note ?? "").trim();
      if (!target || !note) {
        return "Error: target and message are required for steer";
      }
      const resolved = resolveTarget(target, this.manager.listRuns());
      if (!resolved) {
        return `Error: subagent not found (${target})`;
      }
      const ok = this.manager.steerRun(resolved.id, note);
      return ok ? `Subagent ${resolved.id} steer applied` : `Subagent ${resolved.id} not running`;
    }
    return "Error: invalid action";
  }
}

function resolveTarget(
  token: string,
  runs: Array<{ id: string; label: string; status: string; startedAt: string; doneAt?: string }>
): { id: string; label: string } | null {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }
  const sorted = [...runs].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  if (trimmed === "last") {
    return sorted[0] ?? null;
  }
  if (/^\d+$/.test(trimmed)) {
    const idx = Number.parseInt(trimmed, 10);
    if (Number.isFinite(idx) && idx > 0 && idx <= sorted.length) {
      return sorted[idx - 1];
    }
  }
  const byId = runs.find((run) => run.id === trimmed);
  if (byId) {
    return byId;
  }
  const lower = trimmed.toLowerCase();
  const byLabel = runs.filter((run) => run.label.toLowerCase() === lower);
  if (byLabel.length === 1) {
    return byLabel[0];
  }
  return null;
}
