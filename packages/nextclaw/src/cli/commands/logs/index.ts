import { getLoggingRuntime, type AppLogKind, type LoggingRuntime } from "@nextclaw/core";
import type { LogsTailCommandOptions } from "../../shared/types/cli.types.js";

export class LogsCommands {
  constructor(private readonly runtime: LoggingRuntime = getLoggingRuntime()) {}

  logsPath = (): void => {
    const paths = this.runtime.getPaths();
    console.log([
      `Logs directory: ${paths.logsDir}`,
      `Service log: ${paths.serviceLogPath}`,
      `Crash log: ${paths.crashLogPath}`,
      `Archive: ${paths.archiveDir}`,
    ].join("\n"));
  };

  logsTail = (opts: LogsTailCommandOptions = {}): void => {
    const kind: AppLogKind = opts.crash ? "crash" : "service";
    const rawLines = Number(opts.lines);
    const lines = Number.isFinite(rawLines) && rawLines > 0 ? Math.floor(rawLines) : 40;
    const output = this.runtime.tail(kind, lines);
    if (output.length === 0) {
      console.log(`No log entries found in ${this.runtime.resolveLogPath(kind)}.`);
      return;
    }
    console.log(output.join("\n"));
  };
}
