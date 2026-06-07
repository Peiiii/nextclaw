import type { BrowserConnectorManager } from "@/managers/browser-connector.manager.js";
import type { BrowserConnectorCommandOutput } from "@/types/cli-output.types.js";

export class StatusController {
  constructor(private readonly browserConnectorManager: BrowserConnectorManager) {}

  run = async (): Promise<BrowserConnectorCommandOutput> => ({
    ok: true,
    status: await this.browserConnectorManager.status(),
  });
}
