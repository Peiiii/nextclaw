import type { PortalWorkerEnv } from "../portal-env.types.js";
import { digest, reject, secureEqual } from "./support-validation.utils.js";

export class SupportAuthService {
  constructor(private readonly env: PortalWorkerEnv) {}
  user = async (authorization: string): Promise<string | null> => {
    if (!authorization.startsWith("Bearer ") || !this.env.SUPPORT_PLATFORM_API_BASE) return null;
    const base = this.env.SUPPORT_PLATFORM_API_BASE.replace(/\/$/, "");
    const url = new URL(base);
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) return null;
    try {
      const response = await fetch(base + "/platform/auth/me", {
        headers: { authorization }, signal: AbortSignal.timeout(5000), redirect: "manual"
      });
      if (!response.ok) return null;
      const data = await response.json() as { ok?: boolean; data?: { user?: { id?: unknown } } };
      return data.ok && typeof data.data?.user?.id === "string" ? data.data.user.id : null;
    } catch { return null; }
  };
  maintenance = async (authorization: string): Promise<void> => {
    const expected = this.env.SUPPORT_MAINTAINER_TOKEN;
    if (!expected || expected.length < 32) reject(503, "维护接口尚未启用。");
    if (!secureEqual(await digest(authorization), await digest("Bearer " + expected))) reject(401, "维护身份无效。");
  };
  administrator = async (authorization: string): Promise<void> => {
    const expected = this.env.SUPPORT_ADMIN_TOKEN;
    if (!expected || expected.length < 32 || expected === this.env.SUPPORT_MAINTAINER_TOKEN) reject(503, "请配置独立的管理员凭据。");
    if (!secureEqual(await digest(authorization), await digest("Bearer " + expected))) reject(403, "需要管理员评审权限。");
  };
}
