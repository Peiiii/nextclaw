import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppInstanceService } from "../host/app-instance.service.js";

export class HostBridgeServer {
  constructor(private readonly appInstance: AppInstanceService) {}

  handle = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<boolean> => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (!requestUrl.pathname.startsWith("/__napp")) {
      return false;
    }

    if (request.method === "GET" && requestUrl.pathname === "/__napp/health") {
      this.writeJson(response, 200, { ok: true });
      return true;
    }

    if (request.method === "GET" && requestUrl.pathname === "/__napp/manifest") {
      this.writeJson(response, 200, {
        ok: true,
        manifest: this.appInstance.summarizeManifest(),
      });
      return true;
    }

    if (request.method === "GET" && requestUrl.pathname === "/__napp/permissions") {
      this.writeJson(response, 200, {
        ok: true,
        permissions: this.appInstance.summarizePermissions(),
      });
      return true;
    }

    if (request.method === "POST" && requestUrl.pathname === "/__napp/run") {
      const body = await this.readJsonBody<{ action?: string }>(request);
      const result = await this.appInstance.runAction(body.action);
      this.writeJson(response, 200, { ok: true, result });
      return true;
    }

    this.writeJson(response, 404, {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: `Unknown bridge path: ${requestUrl.pathname}`,
      },
    });
    return true;
  };

  private readJsonBody = async <T>(request: IncomingMessage): Promise<T> => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const rawBody = Buffer.concat(chunks).toString("utf-8").trim();
    if (!rawBody) {
      return {} as T;
    }
    return JSON.parse(rawBody) as T;
  };

  private writeJson = (
    response: ServerResponse,
    statusCode: number,
    payload: unknown,
  ): void => {
    response.writeHead(statusCode, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(JSON.stringify(payload, null, 2));
  };
}
