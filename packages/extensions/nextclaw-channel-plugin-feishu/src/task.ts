import type { OpenClawPluginApi } from "./nextclaw-sdk/feishu.js";
import { resolveRegisteredFeishuToolsConfig } from "./tool-account.js";
import { registerFeishuTaskCommentTool } from "./task-comment.js";
import { registerFeishuTaskSubtaskTool } from "./task-subtask.js";
import { registerFeishuTaskTaskTool } from "./task-task.js";
import { registerFeishuTaskTasklistTool } from "./task-tasklist.js";

export function registerFeishuTaskTools(api: OpenClawPluginApi) {
  if (!api.config) return;
  if (!resolveRegisteredFeishuToolsConfig(api.config).task) return;
  registerFeishuTaskTaskTool(api);
  registerFeishuTaskTasklistTool(api);
  registerFeishuTaskCommentTool(api);
  registerFeishuTaskSubtaskTool(api);
}
