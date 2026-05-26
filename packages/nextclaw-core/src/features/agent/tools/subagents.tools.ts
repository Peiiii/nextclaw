import { Tool, normalizeToolParams } from "./base.tools.js";
import type { SubagentManager } from "@core/features/agent/managers/subagent.manager.js";

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

  execute = async (args: unknown): Promise<string> => {
    const params = normalizeToolParams(args);
    const action = String(params.action ?? "");
    if (action === "list") {
      return this.listRuns(params);
    }
    if (action === "kill") {
      return this.killRun(params);
    }
    if (action === "steer") {
      return this.steerRun(params);
    }
    return "Error: invalid action";
  };

  private listRuns = (params: Record<string, unknown>): string => {
    const recentMinutes = readRecentMinutes(params.recentMinutes);
    const runs = this.manager.listRuns();
    return JSON.stringify({ runs: recentMinutes ? filterRecentRuns(runs, recentMinutes) : runs }, null, 2);
  };

  private killRun = (params: Record<string, unknown>): string => {
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
  };

  private steerRun = (params: Record<string, unknown>): string => {
    const { target: targetParam, id, message, note: noteParam } = params;
    const target = String(targetParam ?? id ?? "").trim();
    const note = String(message ?? noteParam ?? "").trim();
    if (!target || !note) {
      return "Error: target and message are required for steer";
    }
    const resolved = resolveTarget(target, this.manager.listRuns());
    if (!resolved) {
      return `Error: subagent not found (${target})`;
    }
    const ok = this.manager.steerRun(resolved.id, note);
    return ok ? `Subagent ${resolved.id} steer applied` : `Subagent ${resolved.id} not running`;
  };
}

function readRecentMinutes(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : null;
}

function filterRecentRuns(
  runs: Array<{ id: string; label: string; status: string; startedAt: string; doneAt?: string }>,
  recentMinutes: number
): Array<{ id: string; label: string; status: string; startedAt: string; doneAt?: string }> {
  const now = Date.now();
  return runs.filter((run) => {
    const startedAt = Date.parse(run.startedAt);
    const doneAt = run.doneAt ? Date.parse(run.doneAt) : NaN;
    const ts = Number.isFinite(doneAt) ? doneAt : startedAt;
    return Number.isFinite(ts) && now - ts <= recentMinutes * 60 * 1000;
  });
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
