import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { createServer, type Server, type Socket } from "node:net";

import type {
  BrowserIpcRequest,
  BrowserIpcResponse,
} from "@/types/browser-connector-json.types.js";

export type BrowserIpcRequestHandler = (
  request: BrowserIpcRequest,
) => Promise<BrowserIpcResponse>;

export class LocalIpcServerService {
  private server?: Server;

  constructor(
    private readonly ipcPath: string,
    private readonly handler: BrowserIpcRequestHandler,
  ) {}

  start = async (): Promise<void> => {
    if (process.platform !== "win32" && existsSync(this.ipcPath)) {
      await rm(this.ipcPath, { force: true });
    }

    this.server = createServer(this.handleSocket);

    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(this.ipcPath, resolve);
    });
  };

  stop = async (): Promise<void> => {
    const server = this.server;
    this.server = undefined;

    if (!server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    if (process.platform !== "win32" && existsSync(this.ipcPath)) {
      await rm(this.ipcPath, { force: true });
    }
  };

  private handleSocket = (socket: Socket): void => {
    let buffer = "";

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const newlineIndex = buffer.indexOf("\n");

      if (newlineIndex === -1) {
        return;
      }

      const line = buffer.slice(0, newlineIndex);
      void this.respond(socket, JSON.parse(line) as BrowserIpcRequest);
    });
  };

  private respond = async (
    socket: Socket,
    request: BrowserIpcRequest,
  ): Promise<void> => {
    const response = await this.handler(request);
    socket.end(`${JSON.stringify(response)}\n`);
  };
}
