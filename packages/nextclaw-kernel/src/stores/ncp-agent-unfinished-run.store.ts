import { createReadStream } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import {
  applyNcpAgentRunLifecycleEvent,
  type UnfinishedNcpAgentRun,
} from "@kernel/utils/ncp-agent-unfinished-run.utils.js";
import {
  isRecord,
  type NcpAgentSessionJournalReplayEvent,
  safeNcpSessionFilename,
} from "@kernel/utils/ncp-agent-session-journal.utils.js";

export class NcpAgentUnfinishedRunStore {
  constructor(
    private readonly journalDir: string,
    private readonly listSessionIds: () => Promise<string[]>,
  ) {}

  list = async (): Promise<UnfinishedNcpAgentRun[]> => {
    const runs: UnfinishedNcpAgentRun[] = [];
    for (const sessionId of await this.listSessionIds()) {
      const run = await this.read(sessionId);
      if (run) {
        runs.push(run);
      }
    }
    return runs;
  };

  private read = async (sessionId: string): Promise<UnfinishedNcpAgentRun | null> => {
    const input = createReadStream(this.sessionPath(sessionId), { encoding: "utf-8" });
    const lines = createInterface({ input, crlfDelay: Infinity });
    let activeRun: UnfinishedNcpAgentRun | null = null;
    try {
      for await (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue;
        }
        if (!isRecord(parsed) || parsed._type !== "event" || !isRecord(parsed.event)) {
          continue;
        }
        activeRun = applyNcpAgentRunLifecycleEvent(
          sessionId,
          activeRun,
          parsed.event as unknown as NcpAgentSessionJournalReplayEvent,
        );
      }
      return activeRun;
    } catch {
      return null;
    } finally {
      lines.close();
      input.destroy();
    }
  };

  private sessionPath = (sessionId: string): string =>
    join(this.journalDir, `${safeNcpSessionFilename(sessionId.replace(/:/g, "_"))}.jsonl`);
}
