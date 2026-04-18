import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "./nextclaw-sdk/feishu.js";
import { requestDeviceAuthorization, pollDeviceToken } from "./device-flow.js";
import { feishuFetch } from "./feishu-fetch.js";
import { getTicket } from "./lark-ticket.js";
import { getStoredToken, setStoredToken, tokenStatus } from "./token-store.js";
import { resolveRegisteredFeishuToolsConfig } from "./tool-account.js";
import { revokeUAT } from "./uat-client.js";
import { createUserToolClient } from "./user-tool-client.js";
import { jsonToolResult } from "./tool-result.js";
import { getAllKnownScopes } from "./tool-scopes.js";

const FeishuOAuthSchema = Type.Object({
  action: Type.Union([
    Type.Literal("authorize"),
    Type.Literal("status"),
    Type.Literal("revoke"),
  ]),
  scope: Type.Optional(
    Type.String({
      description: "可选，自定义 scope 空格串；不传时默认申请当前集成能力需要的全部高价值 scope。",
    }),
  ),
  wait_seconds: Type.Optional(
    Type.Integer({
      description: "authorize 后轮询等待秒数，默认 15，最大 60。",
      minimum: 0,
      maximum: 60,
    }),
  ),
});

function json(data: unknown) {
  return jsonToolResult(data);
}

async function verifyTokenIdentity(
  domain: "feishu" | "lark" | (string & {}),
  accessToken: string,
  expectedOpenId: string,
): Promise<{ valid: boolean; actualOpenId?: string }> {
  const baseUrl = domain === "lark" ? "https://open.larksuite.com" : "https://open.feishu.cn";
  const response = await feishuFetch(`${baseUrl}/open-apis/authen/v1/user_info`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await response.json()) as {
    code?: number;
    data?: { open_id?: string };
  };
  const actualOpenId = data.data?.open_id;
  return {
    valid: data.code === 0 && actualOpenId === expectedOpenId,
    actualOpenId,
  };
}

async function handleOAuthStatus(params: {
  appId: string;
  senderOpenId: string;
}) {
  const stored = await getStoredToken(params.appId, params.senderOpenId);
  if (!stored) {
    return json({
      authorized: false,
      user_open_id: params.senderOpenId,
    });
  }
  return json({
    authorized: true,
    user_open_id: params.senderOpenId,
    scope: stored.scope,
    token_status: tokenStatus(stored),
    granted_at: new Date(stored.grantedAt).toISOString(),
    expires_at: new Date(stored.expiresAt).toISOString(),
    refresh_expires_at: new Date(stored.refreshExpiresAt).toISOString(),
  });
}

async function handleOAuthRevoke(params: {
  appId: string;
  senderOpenId: string;
}) {
  await revokeUAT(params.appId, params.senderOpenId);
  return json({
    success: true,
    user_open_id: params.senderOpenId,
    message: "当前用户的飞书 OAuth 授权已撤销。",
  });
}

async function handleOAuthAuthorize(params: {
  account: ReturnType<typeof createUserToolClient>["account"];
  senderOpenId: string;
  scope?: string;
  waitSeconds?: number;
}) {
  const scope = params.scope?.trim() || getAllKnownScopes().join(" ");
  const waitSeconds = Math.min(Math.max(params.waitSeconds ?? 15, 0), 60);
  const deviceFlow = await requestDeviceAuthorization({
    appId: params.account.appId,
    appSecret: params.account.appSecret,
    domain: params.account.domain,
    scope,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), waitSeconds * 1000);
  try {
    const result = await pollDeviceToken({
      appId: params.account.appId,
      appSecret: params.account.appSecret,
      domain: params.account.domain,
      deviceCode: deviceFlow.deviceCode,
      interval: deviceFlow.interval,
      expiresIn: deviceFlow.expiresIn,
      signal: controller.signal,
    });

    if (!result.ok) {
      return json({
        authorized: false,
        status: result.error,
        message: result.message,
        user_open_id: params.senderOpenId,
        verification_uri: deviceFlow.verificationUri,
        verification_uri_complete: deviceFlow.verificationUriComplete,
        user_code: deviceFlow.userCode,
        requested_scope: scope,
      });
    }

    const verified = await verifyTokenIdentity(
      params.account.domain,
      result.token.accessToken,
      params.senderOpenId,
    );
    if (!verified.valid) {
      return json({
        authorized: false,
        status: "identity_mismatch",
        message: "完成授权的飞书账号与当前消息发送者不一致，已拒绝写入令牌。",
        expected_open_id: params.senderOpenId,
        actual_open_id: verified.actualOpenId,
      });
    }

    const now = Date.now();
    await setStoredToken({
      userOpenId: params.senderOpenId,
      appId: params.account.appId,
      accessToken: result.token.accessToken,
      refreshToken: result.token.refreshToken,
      expiresAt: now + result.token.expiresIn * 1000,
      refreshExpiresAt: now + result.token.refreshExpiresIn * 1000,
      scope: result.token.scope,
      grantedAt: now,
    });
    return json({
      authorized: true,
      user_open_id: params.senderOpenId,
      scope: result.token.scope,
      expires_at: new Date(now + result.token.expiresIn * 1000).toISOString(),
      message: "飞书 OAuth 授权成功，后续工具将按当前用户身份执行。",
    });
  } catch (error) {
    if (!controller.signal.aborted) {
      throw error;
    }
    return json({
      authorized: false,
      status: "authorization_pending",
      message:
        "授权请求已创建，但在等待窗口内尚未完成。请打开链接完成授权后重新调用 feishu_oauth status 或再次 authorize。",
      user_open_id: params.senderOpenId,
      verification_uri: deviceFlow.verificationUri,
      verification_uri_complete: deviceFlow.verificationUriComplete,
      user_code: deviceFlow.userCode,
      requested_scope: scope,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function registerFeishuOAuthTool(api: OpenClawPluginApi) {
  if (!api.config) {
    return;
  }

  const toolsConfig = resolveRegisteredFeishuToolsConfig(api.config);
  if (!toolsConfig.oauth) {
    return;
  }

  api.registerTool(
    {
      name: "feishu_oauth",
      label: "Feishu OAuth",
      description:
        "管理当前消息发送者的飞书 OAuth 授权。支持 authorize/status/revoke，授权后 calendar/task/sheets/identity 工具即可按本人身份执行。",
      parameters: FeishuOAuthSchema,
      async execute(_toolCallId, params) {
        const payload = params as {
          action: "authorize" | "status" | "revoke";
          scope?: string;
          wait_seconds?: number;
        };

        const ticket = getTicket();
        const senderOpenId = ticket?.senderOpenId;
        if (!senderOpenId) {
          return json({
            error: "missing_sender_identity",
            message: "当前不在飞书消息上下文中，无法按本人身份管理 OAuth。",
          });
        }

        try {
          const client = createUserToolClient(api.config);
          const account = client.account;
          if (payload.action === "status") {
            return handleOAuthStatus({ appId: account.appId, senderOpenId });
          }
          if (payload.action === "revoke") {
            return handleOAuthRevoke({ appId: account.appId, senderOpenId });
          }
          return handleOAuthAuthorize({
            account,
            senderOpenId,
            scope: payload.scope,
            waitSeconds: payload.wait_seconds,
          });
        } catch (error) {
          return json({
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    },
    { name: "feishu_oauth" },
  );
}
