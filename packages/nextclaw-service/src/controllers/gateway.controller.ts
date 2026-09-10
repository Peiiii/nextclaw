import {
  type GatewayController,
} from "@nextclaw/core";
import type { ConfigManager } from "@nextclaw/kernel";
import { getPackageVersion } from "../utils/cli.utils.js";

type ControllerDeps = {
  configManager: ConfigManager;
};

export class GatewayControllerImpl implements GatewayController {
  constructor(private deps: ControllerDeps) {}

  getConfig = async (): Promise<Record<string, unknown>> => {
    return this.deps.configManager.getConfigSnapshot({ version: getPackageVersion() });
  };

  getConfigSchema = async (): Promise<Record<string, unknown>> => {
    return this.deps.configManager.getConfigSchema({ version: getPackageVersion() });
  };

  applyConfig = async (params: {
    raw: string;
    baseHash?: string;
    note?: string;
  }): Promise<Record<string, unknown>> => {
    return this.deps.configManager.applyRawConfig({
      raw: params.raw,
      baseHash: params.baseHash,
      note: params.note,
      version: getPackageVersion()
    });
  };

  patchConfig = async (params: {
    raw: string;
    baseHash?: string;
    note?: string;
  }): Promise<Record<string, unknown>> => {
    return this.deps.configManager.patchRawConfig({
      raw: params.raw,
      baseHash: params.baseHash,
      note: params.note,
      version: getPackageVersion()
    });
  };

}
