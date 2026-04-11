import { RuntimeLogManager, type RuntimeLogKind } from "../runtime-logging/runtime-log-manager.js";
import type { LogsTailCommandOptions } from "../types.js";

export class LogsCommands {
  constructor(private readonly manager: RuntimeLogManager = new RuntimeLogManager()) {}

  logsPath = (): void => {
    const paths = this.manager.getPaths();
    console.log([
      `Logs directory: ${paths.logsDir}`,
      `Service log: ${paths.serviceLogPath}`,
      `Crash log: ${paths.crashLogPath}`,
      `Archive: ${paths.archiveDir}`,
    ].join("\n"));
  };

  logsTail = (opts: LogsTailCommandOptions = {}): void => {
    const kind: RuntimeLogKind = opts.crash ? "crash" : "service";
    const rawLines = Number(opts.lines);
    const lines = Number.isFinite(rawLines) && rawLines > 0 ? Math.floor(rawLines) : 40;
    const output = this.manager.tail(kind, lines);
    if (output.length === 0) {
      console.log(`No log entries found in ${this.manager.resolveLogPath(kind)}.`);
      return;
    }
    console.log(output.join("\n"));
  };
}
