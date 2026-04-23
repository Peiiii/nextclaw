import { spawn, type ChildProcessByStdio } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import type { Readable } from "node:stream";

export type WasmtimeWasiHttpComponentStartOptions = {
  wasmPath: string;
  dataDirectory: string;
};

export type WasmtimeWasiHttpComponentHandle = {
  url: string;
  port: number;
};

export class WasmtimeWasiHttpComponentService {
  private process?: ChildProcessByStdio<null, Readable, Readable>;
  private handle?: WasmtimeWasiHttpComponentHandle;

  start = async (
    options: WasmtimeWasiHttpComponentStartOptions,
  ): Promise<WasmtimeWasiHttpComponentHandle> => {
    if (this.process) {
      throw new Error("WASI HTTP component 已经启动。");
    }
    const dataDirectory = path.resolve(options.dataDirectory);
    await mkdir(dataDirectory, { recursive: true });
    const port = await this.findAvailablePort();
    const child = spawn(
      "wasmtime",
      [
        "serve",
        "-S",
        "cli=y",
        "-S",
        "http=y",
        "-S",
        "inherit-network=y",
        "--addr",
        `127.0.0.1:${port}`,
        "--dir",
        `${dataDirectory}::/data`,
        options.wasmPath,
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    this.process = child;
    const handle = {
      url: `http://127.0.0.1:${port}`,
      port,
    };
    this.handle = handle;
    await this.waitUntilReady(handle.url, child);
    return handle;
  };

  stop = async (): Promise<void> => {
    const child = this.process;
    if (!child) {
      return;
    }
    await new Promise<void>((resolve) => {
      child.once("exit", () => {
        resolve();
      });
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
        resolve();
      }, 1_000).unref();
    });
    this.process = undefined;
    this.handle = undefined;
  };

  handleRequest = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<boolean> => {
    const handle = this.handle;
    if (!handle) {
      return false;
    }
    const requestUrl = new URL(request.url ?? "/", handle.url);
    if (!requestUrl.pathname.startsWith("/api/")) {
      return false;
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (value === undefined || key.toLowerCase() === "host") {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          headers.append(key, item);
        }
        continue;
      }
      headers.set(key, value);
    }
    const body = await this.readBody(request);
    const upstreamResponse = await fetch(requestUrl, {
      method: request.method,
      headers,
      body: this.methodSupportsBody(request.method) ? body : undefined,
    });
    response.writeHead(upstreamResponse.status, Object.fromEntries(upstreamResponse.headers));
    response.end(Buffer.from(await upstreamResponse.arrayBuffer()));
    return true;
  };

  private readBody = async (request: IncomingMessage): Promise<Buffer> => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  };

  private methodSupportsBody = (method: string | undefined): boolean => {
    return method !== undefined && method !== "GET" && method !== "HEAD";
  };

  private findAvailablePort = async (): Promise<number> => {
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    const address = server.address();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    if (!address || typeof address === "string") {
      throw new Error("无法分配 WASI HTTP component 端口。");
    }
    return address.port;
  };

  private waitUntilReady = async (
    url: string,
    child: ChildProcessByStdio<null, Readable, Readable>,
  ): Promise<void> => {
    const errors: string[] = [];
    child.stderr.on("data", (chunk: Buffer) => {
      errors.push(chunk.toString("utf-8"));
    });
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (child.exitCode !== null) {
        throw new Error(
          `WASI HTTP component 启动失败：${errors.join("").trim() || `exit ${child.exitCode}`}`,
        );
      }
      try {
        await fetch(url);
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    throw new Error(`WASI HTTP component 启动超时：${errors.join("").trim()}`);
  };
}
