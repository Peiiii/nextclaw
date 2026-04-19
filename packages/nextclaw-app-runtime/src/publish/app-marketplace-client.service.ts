import type { AppPublishPayload, AppPublishResult } from "./app-publish.types.js";
import { DEFAULT_APP_MARKETPLACE_API_BASE } from "./app-publish.types.js";

export class AppMarketplaceClientService {
  publish = async (params: {
    payload: AppPublishPayload;
    apiBaseUrl?: string;
    token?: string;
  }): Promise<AppPublishResult> => {
    const apiBaseUrl = this.normalizeApiBase(
      params.apiBaseUrl ?? DEFAULT_APP_MARKETPLACE_API_BASE,
    );
    const token = params.token?.trim();
    if (!token) {
      throw new Error("缺少 marketplace publish token。请先登录 NextClaw，或传入 --token。");
    }
    const response = await fetch(`${apiBaseUrl}/api/v1/apps/publish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        accept: "application/json",
      },
      body: JSON.stringify(params.payload),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        typeof payload === "object" &&
        payload &&
        "error" in payload &&
        typeof (payload as { error?: { message?: unknown } }).error?.message === "string"
          ? (payload as { error: { message: string } }).error.message
          : `${response.status} ${response.statusText}`;
      throw new Error(`发布 app 失败：${message}`);
    }
    const data =
      typeof payload === "object" &&
      payload &&
      "data" in payload &&
      typeof (payload as { data?: unknown }).data === "object"
        ? (payload as { data: AppPublishResult }).data
        : null;
    if (!data) {
      throw new Error("marketplace publish 返回格式无效。");
    }
    return data;
  };

  private normalizeApiBase = (apiBaseUrl: string): string => {
    const normalized = new URL(apiBaseUrl);
    return normalized.toString().replace(/\/+$/, "");
  };
}
