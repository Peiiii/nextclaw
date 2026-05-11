import { CronService } from "@nextclaw/core";

export type AutomationManagerOptions = {
  storePath: string;
};

export class AutomationManager extends CronService {
  constructor(options: AutomationManagerOptions) {
    super(options.storePath);
  }
}
