import { spawn } from "node:child_process";
import type {
  ExtensionManifest,
  RunningExtensionProcess,
} from "@kernel/features/extension-runtime/index.js";

function sanitizeExtensionNodeOptions(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const tokens = value.split(/\s+/).filter(Boolean);
  const sanitized: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--conditions=development" || token === "-C=development") {
      continue;
    }
    if ((token === "--conditions" || token === "-C") && tokens[index + 1] === "development") {
      index += 1;
      continue;
    }
    sanitized.push(token);
  }
  return sanitized.length > 0 ? sanitized.join(" ") : undefined;
}

export class ExtensionLifecycleService {
  private readonly processes = new Map<string, RunningExtensionProcess>();

  startAll = (manifests: ExtensionManifest[], params: {
    endpoint: string;
    token: string;
  }): RunningExtensionProcess[] => {
    const started: RunningExtensionProcess[] = [];
    for (const manifest of manifests) {
      try {
        started.push(this.start(manifest, params));
      } catch (error) {
        console.warn(`Extension ${manifest.id} failed to start: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return started;
  };

  stopAll = async (): Promise<void> => {
    const processes = [...this.processes.values()];
    this.processes.clear();
    await Promise.all(processes.map(async ({ process }) => {
      if (process.exitCode !== null || process.signalCode !== null) {
        return;
      }
      process.kill();
      await new Promise<void>((resolvePromise) => {
        process.once("exit", () => resolvePromise());
        process.once("error", () => resolvePromise());
        setTimeout(resolvePromise, 1000).unref();
      });
    }));
  };

  private start = (
    manifest: ExtensionManifest,
    params: {
      endpoint: string;
      token: string;
    },
  ): RunningExtensionProcess => {
    const existing = this.processes.get(manifest.id);
    if (existing) {
      return existing;
    }
    const command = manifest.server.command === "node" || manifest.server.command === "node.exe"
      ? process.execPath
      : manifest.server.command;
    const child = spawn(command, manifest.server.args ?? [], {
      cwd: manifest.rootDir,
      env: {
        ...process.env,
        NODE_OPTIONS: sanitizeExtensionNodeOptions(process.env.NODE_OPTIONS),
        ...manifest.server.env,
        NEXTCLAW_EXTENSION_ID: manifest.id,
        NEXTCLAW_EXTENSION_ENDPOINT: params.endpoint,
        NEXTCLAW_EXTENSION_TOKEN: params.token,
      },
      stdio: ["ignore", "ignore", "inherit"],
      windowsHide: true,
    });
    const running = { manifest, process: child };
    this.processes.set(manifest.id, running);
    child.once("exit", () => {
      if (this.processes.get(manifest.id)?.process === child) {
        this.processes.delete(manifest.id);
      }
      console.warn(`Extension ${manifest.id} exited.`);
    });
    child.once("error", (error) => {
      console.warn(`Extension ${manifest.id} failed: ${error.message}`);
    });
    return running;
  };
}
