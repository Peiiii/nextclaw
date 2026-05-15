import * as Lark from "@larksuiteoapi/node-sdk";
import type { FeishuDomain, FeishuRuntimeAccount } from "../types/feishu-extension.types.js";

type FeishuMessageClient = {
  im: {
    message: {
      create: (params: {
        params: { receive_id_type: "chat_id" };
        data: { receive_id: string; content: string; msg_type: "text" };
      }) => Promise<{ code?: number; msg?: string; data?: { message_id?: string } }>;
    };
  };
};

function resolveDomain(domain: FeishuDomain): Lark.Domain {
  return domain === "lark" ? Lark.Domain.Lark : Lark.Domain.Feishu;
}

function assertFeishuSuccess(response: { code?: number; msg?: string }, fallback: string): void {
  if (response.code === 0 || response.code === undefined) {
    return;
  }
  throw new Error(`${fallback}: ${response.msg ?? `code ${response.code}`}`);
}

export class FeishuSdkService {
  readonly createClient = (account: FeishuRuntimeAccount): FeishuMessageClient =>
    new Lark.Client({
      appId: account.appId,
      appSecret: account.appSecret,
      appType: Lark.AppType.SelfBuild,
      domain: resolveDomain(account.domain),
    }) as unknown as FeishuMessageClient;

  readonly createEventDispatcher = (): Lark.EventDispatcher =>
    new Lark.EventDispatcher({});

  readonly createWsClient = (account: FeishuRuntimeAccount): Lark.WSClient =>
    new Lark.WSClient({
      appId: account.appId,
      appSecret: account.appSecret,
      domain: resolveDomain(account.domain),
      loggerLevel: Lark.LoggerLevel.info,
    });

  readonly sendText = async (params: {
    account: FeishuRuntimeAccount;
    chatId: string;
    text: string;
  }): Promise<void> => {
    const response = await this.createClient(params.account).im.message.create({
      params: { receive_id_type: "chat_id" },
      data: {
        receive_id: params.chatId,
        content: JSON.stringify({ text: params.text }),
        msg_type: "text",
      },
    });
    assertFeishuSuccess(response, "Feishu send failed");
  };
}
