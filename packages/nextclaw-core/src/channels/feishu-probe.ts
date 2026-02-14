import * as Lark from "@larksuiteoapi/node-sdk";

export type FeishuProbeResult =
  | { ok: true; appId: string; botName?: string; botOpenId?: string }
  | { ok: false; appId?: string; error: string };

type FeishuRequestClient = {
  request: (options: {
    method: string;
    url: string;
    data: Record<string, unknown>;
  }) => Promise<unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export async function probeFeishu(appId: string, appSecret: string): Promise<FeishuProbeResult> {
  if (!appId || !appSecret) {
    return { ok: false, error: "missing credentials (appId, appSecret)" };
  }

  try {
    const client = new Lark.Client({ appId, appSecret });
    const response = await (client as unknown as FeishuRequestClient).request({
      method: "GET",
      url: "/open-apis/bot/v3/info",
      data: {}
    });

    if (!isRecord(response)) {
      return {
        ok: false,
        appId,
        error: "API error: invalid response"
      };
    }

    const code = typeof response.code === "number" ? response.code : null;
    if (code !== 0) {
      const msg = typeof response.msg === "string" ? response.msg : undefined;
      return {
        ok: false,
        appId,
        error: `API error: ${msg || `code ${code ?? "unknown"}`}`
      };
    }

    const botFromResponse = isRecord(response.bot) ? response.bot : undefined;
    const data = isRecord(response.data) ? response.data : undefined;
    const botFromData = data && isRecord(data.bot) ? data.bot : undefined;
    const bot = botFromResponse ?? botFromData;
    const botName = bot && typeof bot.bot_name === "string" ? bot.bot_name : undefined;
    const botOpenId = bot && typeof bot.open_id === "string" ? bot.open_id : undefined;
    return {
      ok: true,
      appId,
      botName,
      botOpenId
    };
  } catch (error) {
    return {
      ok: false,
      appId,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
