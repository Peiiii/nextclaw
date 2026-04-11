import { APP_NAME, loadConfig, type Config } from "@nextclaw/core";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { createServer as createNetServer } from "node:net";
import { resolveUiApiBase, resolveUiConfig } from "../../../utils.js";
import { managedServiceStateStore } from "../../../runtime-state/managed-service-state.store.js";

function getHeaderValue(headers: Record<string, string | string[] | undefined>, key: string): string | null {
  const value = headers[key];
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (Array.isArray(value)) {
    const joined = value.map((item) => item.trim()).filter(Boolean).join(", ");
    return joined.length > 0 ? joined : null;
  }
  return null;
}

function formatProbeBodySnippet(raw: string, maxLength = 180): string | null {
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  const clipped = normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
  return JSON.stringify(clipped);
}

export async function checkPortAvailability(params: {
  host: string;
  port: number;
}): Promise<{ available: boolean; detail: string }> {
  return await new Promise((resolve) => {
    const server = createNetServer();
    server.once("error", (error) => {
      resolve({
        available: false,
        detail: `bind failed on ${params.host}:${params.port} (${String(error)})`
      });
    });
    server.listen(params.port, params.host, () => {
      server.close(() => {
        resolve({
          available: true,
          detail: `bind ok on ${params.host}:${params.port}`
        });
      });
    });
  });
}

export async function probeHealthEndpoint(healthUrl: string): Promise<{ healthy: boolean; error: string | null }> {
  let parsed: URL;
  try {
    parsed = new URL(healthUrl);
  } catch {
    return { healthy: false, error: "invalid health URL" };
  }

  const requestImpl = parsed.protocol === "https:" ? httpsRequest : httpRequest;
  return await new Promise((resolve) => {
    const req = requestImpl(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80,
        method: "GET",
        path: `${parsed.pathname}${parsed.search}`,
        timeout: 1000,
        headers: { Accept: "application/json" }
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => {
          if (typeof chunk === "string") {
            chunks.push(Buffer.from(chunk));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          const responseText = Buffer.concat(chunks).toString("utf-8");
          if ((res.statusCode ?? 0) < 200 || (res.statusCode ?? 0) >= 300) {
            const serverHeader = getHeaderValue(res.headers, "server");
            const contentType = getHeaderValue(res.headers, "content-type");
            const bodySnippet = formatProbeBodySnippet(responseText);
            const details = [`http ${res.statusCode ?? "unknown"}`];
            if (serverHeader) {
              details.push(`server=${serverHeader}`);
            }
            if (contentType) {
              details.push(`content-type=${contentType}`);
            }
            if (bodySnippet) {
              details.push(`body=${bodySnippet}`);
            }
            resolve({ healthy: false, error: details.join("; ") });
            return;
          }

          try {
            const payload = JSON.parse(responseText) as {
              ok?: boolean;
              data?: { status?: string };
            };
            const healthy = payload?.ok === true && payload?.data?.status === "ok";
            if (!healthy) {
              resolve({ healthy: false, error: "health payload not ok" });
              return;
            }
            resolve({ healthy: true, error: null });
          } catch {
            resolve({ healthy: false, error: "invalid health JSON response" });
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("probe timeout"));
    });
    req.on("error", (error) => {
      resolve({ healthy: false, error: error.message || String(error) });
    });
    req.end();
  });
}

export type UiTargetProbeResult =
  | {
      state: "available";
      availabilityDetail: string;
      probeError: null;
    }
  | {
      state: "healthy-existing";
      availabilityDetail: string;
      probeError: null;
    }
  | {
      state: "occupied-unhealthy";
      availabilityDetail: string;
      probeError: string | null;
    };

export async function inspectUiTarget(params: {
  host: string;
  port: number;
  healthUrl: string;
  checkPortAvailabilityFn?: typeof checkPortAvailability;
  probeHealthEndpointFn?: typeof probeHealthEndpoint;
}): Promise<UiTargetProbeResult> {
  const { checkPortAvailabilityFn, healthUrl, host, port, probeHealthEndpointFn } = params;
  const availability = await (checkPortAvailabilityFn ?? checkPortAvailability)({
    host,
    port
  });
  if (availability.available) {
    return {
      state: "available",
      availabilityDetail: availability.detail,
      probeError: null
    };
  }

  const probe = await (probeHealthEndpointFn ?? probeHealthEndpoint)(healthUrl);
  if (probe.healthy) {
    return {
      state: "healthy-existing",
      availabilityDetail: availability.detail,
      probeError: null
    };
  }

  return {
    state: "occupied-unhealthy",
    availabilityDetail: availability.detail,
    probeError: probe.error
  };
}

export async function describeUnmanagedHealthyTargetMessage(params: {
  uiOverrides: Partial<Config["ui"]>;
  checkPortAvailabilityFn?: typeof checkPortAvailability;
  probeHealthEndpointFn?: typeof probeHealthEndpoint;
}): Promise<string | null> {
  const config = loadConfig();
  const uiConfig = resolveUiConfig(config, params.uiOverrides);
  const uiUrl = resolveUiApiBase(uiConfig.host, uiConfig.port);
  const healthUrl = `${uiUrl}/api/health`;
  const target = await inspectUiTarget({
    host: uiConfig.host,
    port: uiConfig.port,
    healthUrl,
    checkPortAvailabilityFn: params.checkPortAvailabilityFn,
    probeHealthEndpointFn: params.probeHealthEndpointFn
  });
  if (target.state !== "healthy-existing") {
    return null;
  }

  return [
    `Target UI health: ${healthUrl}`,
    `A healthy ${APP_NAME} service is already responding on this port, but it is not tracked by ${managedServiceStateStore.path}.`,
    `${APP_NAME} restart only stops the background service recorded in managed state; it will not auto-kill Docker or other external listeners.`,
    `Fix: stop that external service first or rerun with --ui-port <port>.`
  ].join("\n");
}
