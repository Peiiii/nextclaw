import { describe, expect, it } from "vitest";
import type { NcpTool } from "@nextclaw/ncp";
import { ToolProviderManager } from "./tool-provider.manager.js";

function createTool(name: string): NcpTool {
  return {
    name,
    execute: async () => ({ ok: true }),
  };
}

describe("ToolProviderManager", () => {
  it("builds tools from registered providers and keeps the first provider for duplicate names", async () => {
    const manager = new ToolProviderManager();
    const firstSearch = createTool("search");
    const secondSearch = createTool("search");
    const edit = createTool("edit");

    manager.register({
      provide: () => [firstSearch, edit],
    });
    manager.register({
      provide: () => [secondSearch],
    });

    await expect(manager.buildTools({ message: { role: "user", parts: [] } })).resolves.toEqual([
      firstSearch,
      edit,
    ]);
  });

  it("unregisters providers through the disposer returned from register", async () => {
    const manager = new ToolProviderManager();
    const dispose = manager.register({
      provide: () => [createTool("read")],
    });

    dispose();

    await expect(manager.buildTools({ message: { role: "user", parts: [] } })).resolves.toEqual([]);
  });
});
