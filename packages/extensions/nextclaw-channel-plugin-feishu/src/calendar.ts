import type { OpenClawPluginApi } from "./nextclaw-sdk/feishu.js";
import { registerFeishuCalendarCalendarTool } from "./calendar-calendar.js";
import { registerFeishuCalendarEventTool } from "./calendar-event.js";
import { registerFeishuCalendarEventAttendeeTool } from "./calendar-event-attendee.js";
import { registerFeishuCalendarFreebusyTool } from "./calendar-freebusy.js";
import { resolveRegisteredFeishuToolsConfig } from "./tool-account.js";

export function registerFeishuCalendarTools(api: OpenClawPluginApi) {
  if (!api.config) return;
  if (!resolveRegisteredFeishuToolsConfig(api.config).calendar) return;
  registerFeishuCalendarCalendarTool(api);
  registerFeishuCalendarEventTool(api);
  registerFeishuCalendarEventAttendeeTool(api);
  registerFeishuCalendarFreebusyTool(api);
}
