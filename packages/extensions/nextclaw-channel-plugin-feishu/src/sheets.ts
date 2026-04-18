import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "./nextclaw-sdk/feishu.js";
import {
  type SheetParams,
  handleCreate,
  handleExport,
  handleFind,
  handleInfo,
  handleRead,
  handleWrite,
  resolveToken,
} from "./sheets-shared.js";
import { resolveRegisteredFeishuToolsConfig } from "./tool-account.js";
import { createToolContext, handleInvokeError, registerTool, StringEnum } from "./user-tool-helpers.js";

const SheetSchema = Type.Union([
  Type.Object({ action: Type.Literal("info"), url: Type.Optional(Type.String()), spreadsheet_token: Type.Optional(Type.String()) }),
  Type.Object({
    action: Type.Literal("read"),
    url: Type.Optional(Type.String()),
    spreadsheet_token: Type.Optional(Type.String()),
    range: Type.Optional(Type.String()),
    sheet_id: Type.Optional(Type.String()),
    value_render_option: Type.Optional(StringEnum(["FormattedValue", "UnformattedValue", "Formula", "ToString"])),
  }),
  Type.Object({
    action: Type.Literal("write"),
    url: Type.Optional(Type.String()),
    spreadsheet_token: Type.Optional(Type.String()),
    range: Type.Optional(Type.String()),
    sheet_id: Type.Optional(Type.String()),
    values: Type.Array(Type.Array(Type.Any())),
  }),
  Type.Object({
    action: Type.Literal("append"),
    url: Type.Optional(Type.String()),
    spreadsheet_token: Type.Optional(Type.String()),
    range: Type.Optional(Type.String()),
    sheet_id: Type.Optional(Type.String()),
    values: Type.Array(Type.Array(Type.Any())),
  }),
  Type.Object({
    action: Type.Literal("find"),
    url: Type.Optional(Type.String()),
    spreadsheet_token: Type.Optional(Type.String()),
    sheet_id: Type.String(),
    range: Type.Optional(Type.String()),
    find: Type.String(),
    match_case: Type.Optional(Type.Boolean()),
    match_entire_cell: Type.Optional(Type.Boolean()),
    search_by_regex: Type.Optional(Type.Boolean()),
    include_formulas: Type.Optional(Type.Boolean()),
  }),
  Type.Object({
    action: Type.Literal("create"),
    title: Type.String(),
    folder_token: Type.Optional(Type.String()),
    headers: Type.Optional(Type.Array(Type.Any())),
    data: Type.Optional(Type.Array(Type.Array(Type.Any()))),
  }),
  Type.Object({
    action: Type.Literal("export"),
    url: Type.Optional(Type.String()),
    spreadsheet_token: Type.Optional(Type.String()),
    sheet_id: Type.Optional(Type.String()),
    file_extension: StringEnum(["xlsx", "csv"]),
  }),
]);

export function registerFeishuSheetsTools(api: OpenClawPluginApi) {
  if (!api.config) return;
  if (!resolveRegisteredFeishuToolsConfig(api.config).sheets) return;

  registerTool(api, {
    name: "feishu_sheet",
    label: "Feishu Sheet",
    description: "按本人身份读取、写入、创建、查找和导出飞书电子表格。",
    parameters: SheetSchema,
    async execute(_toolCallId, params) {
      const payload = params as SheetParams;
      try {
        const client = createToolContext(api, "feishu_sheet").toolClient();
        if (payload.action === "create") return handleCreate(client, payload);

        const tokenInfo = resolveToken(payload);
        if (!tokenInfo?.token) {
          return json({ error: "请传 spreadsheet_token 或 /sheets/TOKEN 形式的 url。" });
        }
        if (payload.action === "info") return handleInfo(client, tokenInfo.token);
        if (payload.action === "read") return handleRead(client, tokenInfo, payload);
        if (payload.action === "write" || payload.action === "append") return handleWrite(client, tokenInfo, payload);
        if (payload.action === "find") return handleFind(client, tokenInfo.token, payload);
        return handleExport(client, tokenInfo.token, payload);
      } catch (error) {
        return handleInvokeError(error, api);
      }
    },
  }, { name: "feishu_sheet" });
}
