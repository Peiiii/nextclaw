import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export type BrowserConnectorAuditEvent = {
  command: string;
  reason?: string;
  tabRef?: string;
  leaseId?: string;
  url?: string;
  at: string;
};

export class AuditRepository {
  constructor(private readonly homeDir: string) {}

  appendEvent = async (event: BrowserConnectorAuditEvent): Promise<void> => {
    const logsDir = join(this.homeDir, "logs");
    await mkdir(logsDir, { recursive: true });
    await appendFile(
      join(logsDir, "audit.ndjson"),
      `${JSON.stringify(event)}\n`,
    );
  };
}
