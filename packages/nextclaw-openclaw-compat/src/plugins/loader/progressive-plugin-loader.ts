import { appendBundledChannelPluginsProgressively } from "./progressive-bundled-plugin-loader.js";
import type { PluginRegistry } from "../types.js";
import {
  createProgressivePluginLoadContext,
  logPluginStartupTrace,
  type ProgressivePluginLoadOptions
} from "./progressive-plugin-loader-context.js";
import { appendExternalPluginsProgressively } from "./progressive-external-plugin-loader.js";

export type { ProgressivePluginLoadOptions } from "./progressive-plugin-loader-context.js";

export async function loadOpenClawPluginsProgressively(options: ProgressivePluginLoadOptions): Promise<PluginRegistry> {
  const startedAt = Date.now();
  const context = createProgressivePluginLoadContext(options);
  await appendBundledChannelPluginsProgressively(context);
  if (process.env.NEXTCLAW_ENABLE_OPENCLAW_PLUGINS !== "0") {
    await appendExternalPluginsProgressively(context);
  }
  logPluginStartupTrace("plugin.loader.total", {
    duration_ms: Date.now() - startedAt,
    plugin_count: context.registry.plugins.length
  });
  return context.registry;
}
