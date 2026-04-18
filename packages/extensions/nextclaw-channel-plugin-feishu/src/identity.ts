import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "./nextclaw-sdk/feishu.js";
import { resolveRegisteredFeishuToolsConfig } from "./tool-account.js";
import {
  assertLarkOk,
  createToolContext,
  handleInvokeError,
  json,
  registerTool,
  StringEnum,
} from "./user-tool-helpers.js";

const GetUserSchema = Type.Object({
  user_id: Type.Optional(
    Type.String({
      description: "用户 ID（如 ou_xxx）。不传时获取当前消息发送者本人信息。",
    }),
  ),
  user_id_type: Type.Optional(StringEnum(["open_id", "union_id", "user_id"])),
});

const SearchUserSchema = Type.Object({
  query: Type.String({
    description: "搜索关键词，可匹配姓名、邮箱、手机号等。",
  }),
  page_size: Type.Optional(
    Type.Integer({
      description: "分页大小，默认 20，最大 200。",
      minimum: 1,
      maximum: 200,
    }),
  ),
  page_token: Type.Optional(
    Type.String({
      description: "翻页 token。",
    }),
  ),
});

export function registerFeishuIdentityTools(api: OpenClawPluginApi) {
  if (!api.config) {
    return;
  }

  const toolsConfig = resolveRegisteredFeishuToolsConfig(api.config);
  if (!toolsConfig.identity) {
    return;
  }

  registerFeishuGetUserTool(api);
  registerFeishuSearchUserTool(api);
}

function registerFeishuGetUserTool(api: OpenClawPluginApi) {
  const { toolClient, log } = createToolContext(api, "feishu_get_user");

  registerTool(
    api,
    {
      name: "feishu_get_user",
      label: "Feishu: Get User",
      description:
        "获取飞书用户信息。不传 user_id 时默认获取当前消息发送者本人信息；传 user_id 时获取指定用户信息。",
      parameters: GetUserSchema,
      async execute(_toolCallId, params) {
        const payload = params as {
          user_id?: string;
          user_id_type?: "open_id" | "union_id" | "user_id";
        };

        try {
          const client = toolClient();
          if (!payload.user_id) {
            log.info("fetching current user info");
            const response = await client.invoke(
              "feishu_get_user.default",
              (sdk, opts) => sdk.authen.userInfo.get({}, opts),
              { as: "user" },
            );
            assertLarkOk(response);
            return json({ user: response.data });
          }

          log.info(`fetching user ${payload.user_id}`);
          const response = await client.invoke(
            "feishu_get_user.default",
            (sdk, opts) =>
              sdk.contact.user.get(
                {
                  path: { user_id: payload.user_id! },
                  params: {
                    user_id_type: payload.user_id_type ?? "open_id",
                  },
                },
                opts,
              ),
            { as: "user" },
          );
          assertLarkOk(response);
          return json({ user: response.data?.user });
        } catch (error) {
          return handleInvokeError(error, api);
        }
      },
    },
    { name: "feishu_get_user" },
  );
}

function registerFeishuSearchUserTool(api: OpenClawPluginApi) {
  const { toolClient, log } = createToolContext(api, "feishu_search_user");

  registerTool(
    api,
    {
      name: "feishu_search_user",
      label: "Feishu: Search User",
      description: "搜索飞书员工信息，返回姓名、部门、open_id 等结果。",
      parameters: SearchUserSchema,
      async execute(_toolCallId, params) {
        const payload = params as {
          query: string;
          page_size?: number;
          page_token?: string;
        };

        try {
          const client = toolClient();
          log.info(`search query="${payload.query}"`);
          const response = await client.invokeByPath<{
            data?: { users?: unknown[]; has_more?: boolean; page_token?: string };
          }>("feishu_search_user.default", "/open-apis/search/v1/user", {
            method: "GET",
            query: {
              query: payload.query,
              page_size: String(payload.page_size ?? 20),
              ...(payload.page_token ? { page_token: payload.page_token } : {}),
            },
            as: "user",
          });
          assertLarkOk(response as { code?: number; msg?: string });
          return json({
            users: response.data?.users ?? [],
            has_more: response.data?.has_more ?? false,
            page_token: response.data?.page_token,
          });
        } catch (error) {
          return handleInvokeError(error, api);
        }
      },
    },
    { name: "feishu_search_user" },
  );
}
