import { afterEach, describe, expect, it } from "vitest";
import {
  DEV_PLUGIN_HOT_RELOAD_TARGETS_ENV,
  resolveDevPluginHotReloadTargets,
} from "./plugin-dev-hot-reload.utils.js";

afterEach(() => {
  delete process.env[DEV_PLUGIN_HOT_RELOAD_TARGETS_ENV];
});

describe("resolveDevPluginHotReloadTargets", () => {
  it("parses plugin hot reload targets from env json", () => {
    process.env[DEV_PLUGIN_HOT_RELOAD_TARGETS_ENV] = JSON.stringify([
      {
        pluginId: "codex",
        pluginPath: "/tmp/codex",
        watchPaths: ["/tmp/codex/dist", "/tmp/codex/dist"],
      },
      {
        pluginId: "feishu",
        pluginPath: "/tmp/feishu",
        watchPaths: ["/tmp/feishu/dist"],
      },
    ]);

    expect(resolveDevPluginHotReloadTargets()).toEqual([
      {
        pluginId: "codex",
        pluginPath: "/tmp/codex",
        watchPaths: ["/tmp/codex/dist"],
      },
      {
        pluginId: "feishu",
        pluginPath: "/tmp/feishu",
        watchPaths: ["/tmp/feishu/dist"],
      },
    ]);
  });

  it("rejects duplicate plugin ids", () => {
    process.env[DEV_PLUGIN_HOT_RELOAD_TARGETS_ENV] = JSON.stringify([
      {
        pluginId: "codex",
        pluginPath: "/tmp/codex-a",
        watchPaths: ["/tmp/codex-a/dist"],
      },
      {
        pluginId: "codex",
        pluginPath: "/tmp/codex-b",
        watchPaths: ["/tmp/codex-b/dist"],
      },
    ]);

    expect(() => resolveDevPluginHotReloadTargets()).toThrow(/duplicate plugin target/i);
  });
});
