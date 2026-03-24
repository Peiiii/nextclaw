import { LarkClient } from "./lark-client.js";
import type { FeishuBrand } from "./accounts.js";

export type FeishuProbeResult =
  | { ok: true; appId: string; botName?: string; botOpenId?: string }
  | { ok: false; appId?: string; error: string };

export async function probeFeishu(
  appId: string,
  appSecret: string,
  options?: { domain?: FeishuBrand }
): Promise<FeishuProbeResult> {
  const client = LarkClient.fromCredentials({
    accountId: "probe",
    appId,
    appSecret,
    brand: options?.domain ?? "feishu"
  });
  return client.probe();
}
