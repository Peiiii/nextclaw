type QQGatewaySessionStartLimit = {
  total?: unknown;
  remaining?: unknown;
  reset_after?: unknown;
  max_concurrency?: unknown;
};

type QQGatewayResponse = {
  url?: unknown;
  shards?: unknown;
  session_start_limit?: QQGatewaySessionStartLimit;
};

type QQFetch = typeof fetch;

type QQGatewayStartupProbeConfig = {
  appId: string;
  secret: string;
  fetchImpl?: QQFetch;
};

export class QQGatewaySessionLimitError extends Error {
  constructor(readonly resetAfterMs: number | null, readonly total: number | null, readonly maxConcurrency: number | null) {
    super(
      `QQ gateway session start limit exhausted; reset_after_ms=${resetAfterMs ?? "unknown"}, total=${total ?? "unknown"}, max_concurrency=${maxConcurrency ?? "unknown"}`
    );
    this.name = "QQGatewaySessionLimitError";
  }
}

export class QQGatewayStartupProbeService {
  constructor(private readonly config: QQGatewayStartupProbeConfig) {}

  verifySessionAvailable = async (): Promise<void> => {
    const accessToken = await this.fetchQqAccessToken();
    const gateway = await this.fetchQqGateway(accessToken);
    const limit = gateway.session_start_limit;
    const remaining = this.readFiniteNumber(limit?.remaining);
    if (remaining === undefined || remaining > 0) {
      return;
    }
    throw new QQGatewaySessionLimitError(
      this.readFiniteNumber(limit?.reset_after) ?? null,
      this.readFiniteNumber(limit?.total) ?? null,
      this.readFiniteNumber(limit?.max_concurrency) ?? null
    );
  };

  private fetchQqAccessToken = async (): Promise<string> => {
    const response = await this.fetchImpl("https://bots.qq.com/app/getAppAccessToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "QQBot/1.0",
      },
      body: JSON.stringify({
        appId: this.config.appId,
        clientSecret: this.config.secret,
      }),
    });
    const payload = await response.json() as Record<string, unknown>;
    const token = typeof payload.access_token === "string" ? payload.access_token : "";
    if (!response.ok || !token) {
      throw new Error(`QQ access token probe failed: status=${response.status}`);
    }
    return token;
  };

  private fetchQqGateway = async (accessToken: string): Promise<QQGatewayResponse> => {
    const response = await this.fetchImpl("https://api.sgroup.qq.com/gateway/bot", {
      headers: {
        Authorization: `QQBot ${accessToken}`,
      },
    });
    const payload = await response.json() as QQGatewayResponse;
    if (!response.ok || typeof payload.url !== "string") {
      throw new Error(`QQ gateway probe failed: status=${response.status}`);
    }
    return payload;
  };

  private readFiniteNumber = (value: unknown): number | undefined => {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  };

  private get fetchImpl(): QQFetch {
    return this.config.fetchImpl ?? fetch;
  }
}
