import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_HEARTBEAT_INTERVAL_S = 30 * 60;
export const HEARTBEAT_PROMPT = "Read HEARTBEAT.md in your workspace (if it exists).\nFollow any instructions or tasks listed there.\nIf nothing needs attention, reply with just: HEARTBEAT_OK";
export const HEARTBEAT_OK_TOKEN = "HEARTBEAT_OK";

function formatBackgroundTaskError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}

function isHeartbeatEmpty(content?: string | null): boolean {
  if (!content) {
    return true;
  }
  const skipPatterns = new Set(["- [ ]", "* [ ]", "- [x]", "* [x]"]);
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("<!--") || skipPatterns.has(trimmed)) {
      continue;
    }
    return false;
  }
  return true;
}

export class HeartbeatService {
  private running = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private workspace: string,
    private onHeartbeat: ((prompt: string) => Promise<string>) | null,
    private intervalS: number = DEFAULT_HEARTBEAT_INTERVAL_S,
    private enabled = true
  ) {}

  get heartbeatFile(): string {
    return join(this.workspace, "HEARTBEAT.md");
  }

  private readonly readHeartbeatFile = (): string | null => {
    if (existsSync(this.heartbeatFile)) {
      try {
        return readFileSync(this.heartbeatFile, "utf-8");
      } catch {
        return null;
      }
    }
    return null;
  };

  readonly start = async (): Promise<void> => {
    if (!this.enabled) {
      return;
    }
    this.running = true;
    this.timer = setInterval(() => {
      void this.runTickSafely();
    }, this.intervalS * 1000);
  };

  readonly stop = (): void => {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  };

  private readonly tick = async (): Promise<void> => {
    if (!this.running) {
      return;
    }
    const content = this.readHeartbeatFile();
    if (isHeartbeatEmpty(content)) {
      return;
    }
    if (this.onHeartbeat) {
      const response = await this.onHeartbeat(HEARTBEAT_PROMPT);
      if (response.toUpperCase().replace(/_/g, "").includes(HEARTBEAT_OK_TOKEN.replace(/_/g, ""))) {
        return;
      }
    }
  };

  private readonly runTickSafely = async (): Promise<void> => {
    try {
      await this.tick();
    } catch (error) {
      console.error(`[heartbeat] background tick failed: ${formatBackgroundTaskError(error)}`);
    }
  };

  readonly triggerNow = async (): Promise<string | null> => {
    if (!this.onHeartbeat) {
      return null;
    }
    return this.onHeartbeat(HEARTBEAT_PROMPT);
  };
}
