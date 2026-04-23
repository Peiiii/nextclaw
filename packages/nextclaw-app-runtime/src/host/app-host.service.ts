import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { HostBridgeServer } from "../bridge/host-bridge.service.js";
import type { AppInstanceService } from "./app-instance.service.js";
import { UiServerService } from "../ui/ui-server.service.js";
import type { WasmtimeWasiHttpComponentService } from "../runtime/wasmtime-wasi-http-component.service.js";

export type AppHostStartOptions = {
  host: string;
  port: number;
};

export type AppHostHandle = {
  appId: string;
  url: string;
  host: string;
  port: number;
};

export class AppHostService {
  private server?: Server;
  private readonly bridgeServer: HostBridgeServer;
  private readonly uiServer: UiServerService;

  constructor(
    private readonly appInstance: AppInstanceService,
    private readonly wasiHttpComponentService?: WasmtimeWasiHttpComponentService,
  ) {
    this.bridgeServer = new HostBridgeServer(appInstance);
    this.uiServer = new UiServerService(appInstance.bundle);
  }

  start = async (options: AppHostStartOptions): Promise<AppHostHandle> => {
    if (this.server) {
      throw new Error("应用宿主已经启动。");
    }
    const server = createServer((request, response) => {
      void this.handleRequest(request, response);
    });
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(options.port, options.host, () => {
        server.off("error", reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("无法获取应用宿主监听地址。");
    }
    return {
      appId: this.appInstance.bundle.manifest.id,
      url: `http://${address.address}:${address.port}`,
      host: address.address,
      port: address.port,
    };
  };

  stop = async (): Promise<void> => {
    if (!this.server) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.server?.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    this.server = undefined;
  };

  private handleRequest = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    try {
      if (this.wasiHttpComponentService) {
        const backendHandled = await this.wasiHttpComponentService.handleRequest(request, response);
        if (backendHandled) {
          return;
        }
      }
      const bridgeHandled = await this.bridgeServer.handle(request, response);
      if (bridgeHandled) {
        return;
      }
      await this.uiServer.handle(request, response);
    } catch (error) {
      response.writeHead(500, {
        "content-type": "application/json; charset=utf-8",
      });
      response.end(
        JSON.stringify(
          {
            ok: false,
            error: {
              code: "APP_HOST_ERROR",
              message: error instanceof Error ? error.message : String(error),
            },
          },
          null,
          2,
        ),
      );
    }
  };
}
