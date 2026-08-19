import { CronService, type DiagnosticRuntime } from "@nextclaw/core";

export type AutomationManagerOptions = {
  storePath: string;
  diagnostics?: Pick<DiagnosticRuntime, "record">;
};

export class AutomationManager extends CronService {
  constructor(options: AutomationManagerOptions) {
    super(options.storePath, undefined, options.diagnostics);
  }
}
