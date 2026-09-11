import type { ToolProvider } from "@kernel/types/agent-run.types.js";
import type { PanelAppManager } from "@kernel/managers/panel-app.manager.js";
import { createShowContentTools } from "@kernel/tools/show-content.tools.js";
import { isPanelAppError } from "@kernel/types/panel-app.types.js";
import type { NcpTool } from "@nextclaw/ncp";
import type { EventBus } from "@nextclaw/shared";

export class ShowContentToolProvider implements ToolProvider {
  constructor(
    private readonly eventBus: Pick<EventBus, "emit">,
    private readonly panelAppManager: Pick<PanelAppManager, "resolvePanelAppDisplayTarget">,
  ) {}

  provide = (): readonly NcpTool[] => createShowContentTools(
    this.eventBus,
    async (id) => {
      try {
        return (await this.panelAppManager.resolvePanelAppDisplayTarget(id)).appId;
      } catch (error) {
        if (isPanelAppError(error) && error.code === "PANEL_APP_NOT_FOUND") {
          return undefined;
        }
        throw error;
      }
    },
  );
}
