import { randomUUID } from "node:crypto";
import { createConnection } from "node:net";

import type {
  BrowserIpcCommand,
  BrowserIpcRequest,
  BrowserIpcResponse,
} from "@/types/browser-connector-json.types.js";
import { BrowserConnectorError } from "@/types/cli-output.types.js";

export class BrowserConnectorClient {
  constructor(
    private readonly ipcPath: string,
    private readonly timeoutMs = 10_000,
  ) {}

  request = async <TData>(
    command: BrowserIpcCommand,
    payload?: Record<string, unknown>,
  ): Promise<TData> => {
    const request: BrowserIpcRequest = {
      id: randomUUID(),
      command,
      payload,
    };
    const response = await this.sendRequest(request);

    if (!response.ok) {
      throw new BrowserConnectorError(response.error.code, response.error.message, {
        recoverable: response.error.recoverable,
      });
    }

    return response.data as TData;
  };

  private sendRequest = async (
    request: BrowserIpcRequest,
  ): Promise<BrowserIpcResponse> =>
    new Promise<BrowserIpcResponse>((resolve, reject) => {
      const socket = createConnection(this.ipcPath);
      let settled = false;
      let buffer = "";

      const timeout = setTimeout(() => {
        finishWithError(
          new BrowserConnectorError(
            "IPC_REQUEST_FAILED",
            "Timed out waiting for Browser Connector Native Host.",
            { recoverable: true },
          ),
        );
      }, this.timeoutMs);

      const finish = (response: BrowserIpcResponse): void => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        socket.end();
        resolve(response);
      };

      const finishWithError = (error: Error): void => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        socket.destroy();
        reject(error);
      };

      socket.on("connect", () => {
        socket.write(`${JSON.stringify(request)}\n`);
      });

      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        const newlineIndex = buffer.indexOf("\n");

        if (newlineIndex === -1) {
          return;
        }

        const line = buffer.slice(0, newlineIndex);
        finish(JSON.parse(line) as BrowserIpcResponse);
      });

      socket.on("error", (error) => {
        finishWithError(mapSocketError(error, this.ipcPath));
      });
    });
}

const mapSocketError = (error: NodeJS.ErrnoException, ipcPath: string): Error => {
  if (error.code === "ENOENT" || error.code === "ECONNREFUSED") {
    return new BrowserConnectorError(
      "HOST_UNAVAILABLE",
      `Browser Connector Native Host is not reachable at ${ipcPath}. Open Chrome with the Browser Connector extension enabled, then rerun the command.`,
      { recoverable: true },
    );
  }

  return new BrowserConnectorError("IPC_REQUEST_FAILED", error.message, {
    recoverable: true,
  });
};
