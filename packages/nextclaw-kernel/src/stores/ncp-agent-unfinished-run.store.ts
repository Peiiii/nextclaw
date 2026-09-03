import { createReadStream } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { NcpEventType } from "@nextclaw/ncp";
import {
  applyNcpAgentRunLifecycleEvent,
  type UnfinishedNcpAgentRun,
} from "@kernel/utils/ncp-agent-unfinished-run.utils.js";
import {
  isRecord,
  type NcpAgentSessionJournalReplayEvent,
  safeNcpSessionFilename,
} from "@kernel/utils/ncp-agent-session-journal.utils.js";
import type { NcpAgentRunRecoveryCheckpoint } from "./ncp-agent-run-recovery-index.store.js";

const REVERSE_READ_CHUNK_BYTES = 8 * 1024 * 1024;
const RUN_LIFECYCLE_EVENT_NEEDLES = [
  `"type":"${NcpEventType.RunStarted}"`,
  `"type":"${NcpEventType.RunFinished}"`,
  `"type":"${NcpEventType.RunError}"`,
  `"type":"${NcpEventType.MessageAbort}"`,
] as const;

export class NcpAgentUnfinishedRunStore {
  constructor(
    private readonly journalDir: string,
    private readonly listCheckpoints: () => Promise<NcpAgentRunRecoveryCheckpoint[]>,
    private readonly writeCheckpoint: (checkpoint: {
      sessionId: string;
      journalOffset: number;
      activeRun: UnfinishedNcpAgentRun | null;
    }) => Promise<void>,
  ) {}

  list = async (): Promise<UnfinishedNcpAgentRun[]> => {
    const runs: UnfinishedNcpAgentRun[] = [];
    for (const checkpoint of await this.listCheckpoints()) {
      const run = await this.read(checkpoint);
      if (run) {
        runs.push(run);
      }
    }
    return runs;
  };

  private read = async (checkpoint: NcpAgentRunRecoveryCheckpoint): Promise<UnfinishedNcpAgentRun | null> => {
    const { sessionId } = checkpoint;
    const file = await open(this.sessionPath(sessionId), "r").catch(() => null);
    if (!file) {
      return null;
    }
    try {
      const fileSize = (await file.stat()).size;
      const checkpointOffset = checkpoint.journalOffset !== null
        && checkpoint.journalOffset >= 0
        && checkpoint.journalOffset <= fileSize
        ? checkpoint.journalOffset
        : null;
      if (checkpointOffset === fileSize) return checkpoint.activeRun;
      const activeRun = checkpointOffset === null
        ? await this.readLatestRunFromEnd(sessionId, file, fileSize)
        : await this.readRunTail(sessionId, checkpoint.activeRun, checkpointOffset);
      await this.writeCheckpoint({ sessionId, journalOffset: fileSize, activeRun });
      return activeRun;
    } catch {
      return null;
    } finally {
      await file.close();
    }
  };

  private readLatestRunFromEnd = async (
    sessionId: string,
    file: Awaited<ReturnType<typeof open>>,
    fileSize: number,
  ): Promise<UnfinishedNcpAgentRun | null> => {
    const terminalEvents: NcpAgentSessionJournalReplayEvent[] = [];
    let position = fileSize;
      let lineSuffix = "";
      while (position > 0) {
        const length = Math.min(REVERSE_READ_CHUNK_BYTES, position);
        position -= length;
        const buffer = Buffer.allocUnsafe(length);
        const { bytesRead } = await file.read(buffer, 0, length, position);
        const lines = `${buffer.toString("utf8", 0, bytesRead)}${lineSuffix}`.split("\n");
        lineSuffix = position > 0 ? (lines.shift() ?? "") : "";
        for (let index = lines.length - 1; index >= 0; index -= 1) {
          const event = readRunLifecycleEvent(lines[index] ?? "");
          if (!event) {
            continue;
          }
          if (event.type === NcpEventType.RunStarted) {
            return resolveUnfinishedRun(sessionId, event, terminalEvents);
          }
          terminalEvents.push(event);
        }
      }
      return null;
  };

  private readRunTail = async (
    sessionId: string,
    initialRun: UnfinishedNcpAgentRun | null,
    journalOffset: number,
  ): Promise<UnfinishedNcpAgentRun | null> => {
    const stream = createReadStream(this.sessionPath(sessionId), {
      encoding: "utf-8",
      start: journalOffset,
    });
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    let activeRun = initialRun;
    try {
      for await (const line of lines) {
        const event = readRunLifecycleEvent(line);
        if (event) activeRun = applyNcpAgentRunLifecycleEvent(sessionId, activeRun, event);
      }
      return activeRun;
    } finally {
      lines.close();
      stream.destroy();
    }
  };

  private sessionPath = (sessionId: string): string =>
    join(this.journalDir, `${safeNcpSessionFilename(sessionId.replace(/:/g, "_"))}.jsonl`);
}

function readRunLifecycleEvent(line: string): NcpAgentSessionJournalReplayEvent | null {
  if (!line.trim() || !RUN_LIFECYCLE_EVENT_NEEDLES.some((needle) => line.includes(needle))) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed._type !== "event" || !isRecord(parsed.event)) {
    return null;
  }
  const event = parsed.event as unknown as NcpAgentSessionJournalReplayEvent;
  return event.type === NcpEventType.RunStarted
    || event.type === NcpEventType.RunFinished
    || event.type === NcpEventType.RunError
    || event.type === NcpEventType.MessageAbort
    ? event
    : null;
}

function resolveUnfinishedRun(
  sessionId: string,
  startedEvent: NcpAgentSessionJournalReplayEvent,
  reverseTerminalEvents: readonly NcpAgentSessionJournalReplayEvent[],
): UnfinishedNcpAgentRun | null {
  let activeRun = applyNcpAgentRunLifecycleEvent(sessionId, null, startedEvent);
  for (let index = reverseTerminalEvents.length - 1; index >= 0 && activeRun; index -= 1) {
    activeRun = applyNcpAgentRunLifecycleEvent(
      sessionId,
      activeRun,
      reverseTerminalEvents[index]!,
    );
  }
  return activeRun;
}
