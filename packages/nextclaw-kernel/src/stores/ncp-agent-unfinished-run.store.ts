import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  readUnfinishedNcpAgentRun,
  type UnfinishedNcpAgentRun,
} from "@kernel/utils/ncp-agent-unfinished-run.utils.js";
import { parseNcpAgentSessionJournal } from "@kernel/utils/ncp-agent-session-journal-entry.utils.js";
import { safeNcpSessionFilename } from "@kernel/utils/ncp-agent-session-journal.utils.js";

export class NcpAgentUnfinishedRunStore {
  constructor(
    private readonly journalDir: string,
    private readonly listSessionIds: () => Promise<string[]>,
  ) {}

  list = async (): Promise<UnfinishedNcpAgentRun[]> => {
    const runs = await Promise.all((await this.listSessionIds()).map(this.read));
    return runs.filter((run): run is UnfinishedNcpAgentRun => run !== null);
  };

  private read = async (sessionId: string): Promise<UnfinishedNcpAgentRun | null> => {
    try {
      const raw = await readFile(this.sessionPath(sessionId), "utf-8");
      return readUnfinishedNcpAgentRun(
        sessionId,
        parseNcpAgentSessionJournal(raw).events,
      );
    } catch {
      return null;
    }
  };

  private sessionPath = (sessionId: string): string =>
    join(this.journalDir, `${safeNcpSessionFilename(sessionId.replace(/:/g, "_"))}.jsonl`);
}
