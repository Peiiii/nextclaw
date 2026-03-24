import { createPluginRuntimeStore } from "./nextclaw-sdk/compat.js";
import type { PluginRuntime } from "./nextclaw-sdk/feishu.js";

const { setRuntime: setFeishuRuntime, getRuntime: getFeishuRuntime } =
  createPluginRuntimeStore<PluginRuntime>("Feishu runtime not initialized");
export { getFeishuRuntime, setFeishuRuntime };
