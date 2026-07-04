import type { ToolProvider } from "@kernel/types/agent-run.types.js";
import { createShowContentTools } from "@kernel/tools/show-content.tools.js";
import type { NcpTool } from "@nextclaw/ncp";
import type { EventBus } from "@nextclaw/shared";

export class ShowContentToolProvider implements ToolProvider {
  constructor(private readonly eventBus: Pick<EventBus, "emit">) {}

  provide = (): readonly NcpTool[] => createShowContentTools(this.eventBus);
}
