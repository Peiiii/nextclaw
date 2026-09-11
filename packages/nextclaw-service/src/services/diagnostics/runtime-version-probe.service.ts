import type { RuntimeStatusReport } from "@nextclaw-service/types/cli.types.js";

export type RuntimeVersionProbeTarget = {
  apiUrl: string;
  source: "managed-api" | "configured-api";
};

export class RuntimeVersionProbeService {
  readonly probe = async (
    target: RuntimeVersionProbeTarget,
    timeoutMs = 1500,
  ): Promise<RuntimeStatusReport["runtime"]> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(
        `${target.apiUrl.replace(/\/$/, "")}/app/meta`,
        { method: "GET", signal: controller.signal },
      );
      if (!response.ok) {
        return this.failure(target, "invalid-response", `HTTP ${response.status}`);
      }
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: { productVersion?: unknown };
      };
      const version = typeof payload.data?.productVersion === "string"
        ? payload.data.productVersion.trim()
        : "";
      if (payload.ok !== true || !version) {
        return this.failure(target, "invalid-response", "unexpected app metadata payload");
      }
      return {
        state: "ok",
        version,
        source: target.source,
        apiUrl: target.apiUrl,
        detail: "running API reported its product version",
      };
    } catch (error) {
      return this.failure(target, "unavailable", String(error));
    } finally {
      clearTimeout(timer);
    }
  };

  private readonly failure = (
    target: RuntimeVersionProbeTarget,
    state: "invalid-response" | "unavailable",
    detail: string,
  ): RuntimeStatusReport["runtime"] => ({
    state,
    version: null,
    source: target.source,
    apiUrl: target.apiUrl,
    detail,
  });
}
