import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type {
  ToolProvider,
  ToolRegistrationContext,
  ToolRunContext,
} from "@kernel/managers/tool.manager.js";
import { ExtensionToolAdapter } from "@nextclaw/core";

export class ExtensionToolProvider implements ToolProvider {
  readonly id = "nextclaw-extension-tools";

  constructor(private readonly kernel: NextclawKernel) {}

  registerTools = (
    context: ToolRunContext,
    registry: ToolRegistrationContext,
  ): void => {
    const extensionRegistry = this.kernel.extensions.getExtensionRegistry();
    if (!extensionRegistry || extensionRegistry.tools.length === 0) {
      return;
    }

    const seen = new Set<string>();
    for (const registration of extensionRegistry.tools) {
      for (const alias of registration.names) {
        if (seen.has(alias) || registry.hasTool(alias)) {
          continue;
        }
        seen.add(alias);
        registry.registerTool(
          new ExtensionToolAdapter({
            registration,
            alias,
            config: context.config,
            workspaceDir: context.workspace,
            contextProvider: registry.getExtensionToolRunContext,
            diagnostics: extensionRegistry.diagnostics,
          }),
        );
      }
    }
  };
}
