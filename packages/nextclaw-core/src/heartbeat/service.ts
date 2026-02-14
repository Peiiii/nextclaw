import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_HEARTBEAT_INTERVAL_S = 30 * 60;
export const HEARTBEAT_PROMPT = "Read HEARTBEAT.md in your workspace (if it exists).\nFollow any instructions or tasks listed there.\nIf nothing needs attention, reply with just: HEARTBEAT_OK";
export const HEARTBEAT_OK_TOKEN = "HEARTBEAT_OK";

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

  private readHeartbeatFile(): string | null {
    if (existsSync(this.heartbeatFile)) {
      try {
        return readFileSync(this.heartbeatFile, "utf-8");
      } catch {
        return null;
      }
    }
    return null;
  }

  async start(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    this.running = true;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalS * 1000);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
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
  }

  async triggerNow(): Promise<string | null> {
    if (!this.onHeartbeat) {
      return null;
    }
    return this.onHeartbeat(HEARTBEAT_PROMPT);
  }
}
