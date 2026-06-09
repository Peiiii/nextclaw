import type { ToolProvider } from "@kernel/types/agent-run.types.js";
import {
  ShowContentTool,
} from "@kernel/tools/show-content.tools.js";
import type { NcpTool } from "@nextclaw/ncp";

export class ShowContentToolProvider implements ToolProvider {
  provide = (): readonly NcpTool[] => [new ShowContentTool()];
}
