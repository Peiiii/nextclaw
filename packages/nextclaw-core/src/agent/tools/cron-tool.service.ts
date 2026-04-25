import { Tool } from "./base.js";
import type { CronService } from "../../cron/service.js";
import type { CronSchedule } from "../../cron/types.js";

export class CronTool extends Tool {
  private channel = "cli";
  private chatId = "direct";
  private accountId?: string;

  constructor(private cronService: CronService) {
    super();
  }

  get name(): string {
    return "cron";
  }

  get description(): string {
    return "Manage scheduled tasks. Use at for one-time jobs, every/cron for recurring jobs, disable to pause without deleting, and remove to delete permanently. For relative times like 'in 5 minutes', first check the current local time with an available tool and then convert to an absolute ISO datetime with timezone; do not guess.";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "Action to perform: add, list, enable, disable, or remove. list returns all jobs by default, including disabled ones."
        },
        name: { type: "string", description: "Short label for the scheduled job." },
        message: {
          type: "string",
          description: "Instruction the agent should execute when the job runs. Do not put only the final outbound message text here unless the task is literally to send that exact text."
        },
        every: {
          type: "integer",
          description: "Repeat every N seconds. Only use for recurring jobs."
        },
        every_seconds: {
          type: "integer",
          description: "Alias of every. Repeat every N seconds."
        },
        cron: {
          type: "string",
          description: "Cron expression for recurring schedules such as daily or weekdays."
        },
        cron_expr: {
          type: "string",
          description: "Alias of cron."
        },
        at: {
          type: "string",
          description: "Run once at a specific ISO datetime with timezone, for example 2026-03-31T18:05:00+08:00. If the user gave a relative time such as 'in 5 minutes', first check the current local time with an available tool, then convert it to this absolute value."
        },
        deliver: {
          type: "boolean",
          description: "Whether the result should be delivered back to the current chat/channel."
        },
        agentId: {
          type: "string",
          description: "Optional target agent id for the scheduled job. Omit to use the default agent."
        },
        sessionId: {
          type: "string",
          description: "Optional target NCP session id. Omit to use the job-owned cron:<jobId> session."
        },
        session_id: {
          type: "string",
          description: "Alias of sessionId."
        },
        accountId: { type: "string" },
        account_id: { type: "string" },
        includeDisabled: { type: "boolean", description: "For list only. When omitted, disabled jobs are included by default." },
        enabledOnly: { type: "boolean", description: "For list only. Set true to show only enabled jobs." },
        jobId: { type: "string", description: "Job id for enable, disable, or remove." },
        job_id: { type: "string", description: "Alias of jobId." },
        id: { type: "string", description: "Alias of jobId." }
      }
    };
  }

  setContext = (channel: string, chatId: string, accountId?: string | null): void => {
    this.channel = channel;
    this.chatId = chatId;
    this.accountId = typeof accountId === "string" && accountId.trim().length > 0 ? accountId : undefined;
  };

  execute = async (params: Record<string, unknown>): Promise<string> => {
    const action = this.readAction(params);
    if (action === "list") {
      return this.handleList(params);
    }
    if (action === "enable" || action === "disable") {
      return this.handleToggle(action, params);
    }
    if (action === "remove") {
      return this.handleRemove(params);
    }
    return this.handleAdd(params);
  };

  private handleList = (params: Record<string, unknown>): string => {
    const includeDisabled = this.readIncludeDisabled(params);
    return JSON.stringify({
      jobs: this.cronService.listJobs(includeDisabled)
    });
  };

  private handleToggle = (
    action: "enable" | "disable",
    params: Record<string, unknown>,
  ): string => {
    const jobId = this.readJobId(params);
    if (!jobId) {
      return `Error: jobId is required for ${action}`;
    }
    const job = this.cronService.enableJob(jobId, action === "enable");
    if (!job) {
      return JSON.stringify({ action, updated: false, jobId });
    }
    return JSON.stringify({
      action,
      updated: true,
      job: {
        id: job.id,
        name: job.name,
        enabled: job.enabled
      }
    });
  };

  private handleRemove = (params: Record<string, unknown>): string => {
    const jobId = this.readJobId(params);
    if (!jobId) {
      return "Error: jobId is required for remove";
    }
    const removed = this.cronService.removeJob(jobId);
    return JSON.stringify({ removed, jobId });
  };

  private handleAdd = (params: Record<string, unknown>): string => {
    const parsed = this.readAddJobParams(params);
    if ("error" in parsed) {
      return parsed.error;
    }
    const job = this.cronService.addJob({
      name: parsed.name,
      schedule: parsed.schedule,
      message: parsed.message,
      agentId: parsed.agentId,
      sessionId: parsed.sessionId,
      deliver: parsed.deliver,
      channel: this.channel,
      to: this.chatId,
      accountId: parsed.accountId
    });

    return JSON.stringify({
      action: "add",
      job: {
        id: job.id,
        name: job.name
      }
    });
  };

  private readAddJobParams = (params: Record<string, unknown>):
    | {
        name: string;
        message: string;
        schedule: CronSchedule;
        deliver: boolean;
        agentId?: string;
        sessionId?: string;
        accountId?: string;
      }
    | { error: string } => {
    const name = this.readString(params, "name");
    const message = this.readString(params, "message");
    if (!name || !message) {
      return { error: "Error: name and message are required for add" };
    }
    const schedule = this.readSchedule(params);
    if (!schedule) {
      return { error: "Error: Must specify --every, --cron, or --at" };
    }
    return {
      name,
      message,
      schedule,
      deliver: Boolean(params.deliver ?? false),
      agentId: this.readString(params, "agentId"),
      sessionId: this.readSessionId(params),
      accountId: this.readAccountId(params),
    };
  };

  private readAction = (params: Record<string, unknown>): "add" | "list" | "enable" | "disable" | "remove" => {
    const action = this.readString(params, "action")?.toLowerCase();
    if (action === "list" || action === "enable" || action === "disable" || action === "remove") {
      return action;
    }
    return "add";
  };

  private readIncludeDisabled = (params: Record<string, unknown>): boolean => {
    if (typeof params.enabledOnly === "boolean") {
      return !params.enabledOnly;
    }
    if (typeof params.includeDisabled === "boolean") {
      return params.includeDisabled;
    }
    return true;
  };

  private readSchedule = (params: Record<string, unknown>): CronSchedule | null => {
    const every = this.readNumber(params.every) ?? this.readNumber(params.every_seconds);
    const cron = this.readString(params, "cron") ?? this.readString(params, "cron_expr");
    const at = this.readString(params, "at");
    if (every) {
      return { kind: "every", everyMs: every * 1000 };
    }
    if (cron) {
      return { kind: "cron", expr: cron };
    }
    if (at) {
      const atMs = Date.parse(at);
      if (Number.isFinite(atMs)) {
        return { kind: "at", atMs };
      }
    }
    return null;
  };

  private readJobId = (params: Record<string, unknown>): string | undefined => {
    return this.readString(params, "jobId") ?? this.readString(params, "job_id") ?? this.readString(params, "id");
  };

  private readAccountId = (params: Record<string, unknown>): string | undefined => {
    return this.readString(params, "accountId") ?? this.readString(params, "account_id") ?? this.accountId;
  };

  private readSessionId = (params: Record<string, unknown>): string | undefined => {
    return this.readString(params, "sessionId") ?? this.readString(params, "session_id");
  };

  private readString = (params: Record<string, unknown>, key: string): string | undefined => {
    const value = params[key];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  };

  private readNumber = (value: unknown): number | undefined => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };
}
