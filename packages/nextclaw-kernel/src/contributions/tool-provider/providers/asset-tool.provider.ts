import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import { createAssetTools } from "@kernel/features/native-runtime/index.js";
import type {
  ToolProvider,
  ToolRegistrationContext,
  ToolRunContext,
} from "@kernel/managers/tool.manager.js";

export class AssetToolProvider implements ToolProvider {
  readonly id = "nextclaw-asset-tools";

  constructor(private readonly kernel: NextclawKernel) {}

  registerTools = (
    _context: ToolRunContext,
    registry: ToolRegistrationContext,
  ): void => {
    for (const tool of createAssetTools({ assetStore: this.kernel.assetStore })) {
      registry.registerNcpTool(tool);
    }
  };
}
