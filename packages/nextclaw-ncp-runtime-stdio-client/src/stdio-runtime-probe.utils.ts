import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import {
  buildStdioRuntimeLaunchEnv,
  type StdioRuntimeResolvedConfig,
} from "./stdio-runtime-config.utils.js";

type ProbeClientBridge = {
  sessionUpdate: (params: { sessionId: string; update: unknown }) => Promise<void>;
  requestPermission: () => Promise<{ outcome: { outcome: "cancelled" } }>;
  readTextFile: () => Promise<{ content: string }>;
  writeTextFile: () => Promise<Record<string, never>>;
};

const createProbeClientBridge = (): ProbeClientBridge => ({
  sessionUpdate: async () => undefined,
  requestPermission: async () => ({ outcome: { outcome: "cancelled" } }),
  readTextFile: async () => ({ content: "" }),
  writeTextFile: async () => ({}),
});

export async function probeStdioRuntime(config: StdioRuntimeResolvedConfig): Promise<void> {
  const child = spawn(config.command, config.args, {
    cwd: config.cwd,
    env: buildStdioRuntimeLaunchEnv({
      configEnv: config.env,
    }),
    stdio: ["pipe", "pipe", "pipe"],
  });
  const spawnErrorPromise = new Promise<never>((_, reject) => {
    child.once("error", (error) => {
      const cwdSuffix = config.cwd ? ` (cwd: ${config.cwd})` : "";
      reject(
        new Error(
          `[narp-stdio] failed to start stdio runtime command "${config.command}"${cwdSuffix}: ${error.message}`,
        ),
      );
    });
  });

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr = `${stderr}${chunk}`.slice(-4000);
  });

  const stream = acp.ndJsonStream(
    Writable.toWeb(child.stdin),
    Readable.toWeb(child.stdout),
  );
  const connection = new acp.ClientSideConnection(
    () => createProbeClientBridge(),
    stream,
  );

  try {
    const session = await Promise.race([
      (async () => {
        await withTimeout(
          connection.initialize({
            protocolVersion: acp.PROTOCOL_VERSION,
            clientCapabilities: {},
          }),
          config.probeTimeoutMs,
          `[narp-stdio] probe timed out initializing stdio runtime`,
        );
        return withTimeout(
          connection.newSession({
            cwd: config.cwd ?? process.cwd(),
            mcpServers: [],
          }),
          config.probeTimeoutMs,
          `[narp-stdio] probe timed out creating remote session`,
        );
      })(),
      spawnErrorPromise,
    ]);
    await connection.cancel({ sessionId: session.sessionId }).catch(() => undefined);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "[narp-stdio] stdio runtime probe failed";
    throw new Error(`${message}. stderr=${stderr}`.trim());
  } finally {
    child.kill("SIGTERM");
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
