import { execFileSync, spawn } from "node:child_process";
import { realpathSync, readlinkSync } from "node:fs";
import { resolve } from "node:path";
import type {
  ExtensionManifest,
  RunningExtensionProcess,
} from "@kernel/features/extension-runtime/index.js";
import { createRuntimeChildEnv } from "@nextclaw/core";

type ExtensionLifecycleServiceOptions = {
  cleanupOrphanProcesses?: (manifests: ExtensionManifest[]) => void;
};

type ProcessSnapshot = {
  pid: number;
  ppid: number;
  command: string;
};

export class ExtensionLifecycleService {
  private readonly processes = new Map<string, RunningExtensionProcess>();

  constructor(private readonly options: ExtensionLifecycleServiceOptions = {}) {}

  startAll = (manifests: ExtensionManifest[], params: {
    endpoint: string;
    tokenForExtension: (extensionId: string) => string;
  }): RunningExtensionProcess[] => {
    this.cleanupOrphanProcesses(manifests);
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
      tokenForExtension: (extensionId: string) => string;
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
      env: createRuntimeChildEnv(process.env, {
        ...manifest.server.env,
        NEXTCLAW_EXTENSION_ID: manifest.id,
        NEXTCLAW_EXTENSION_ENDPOINT: params.endpoint,
        NEXTCLAW_EXTENSION_PARENT_PID: String(process.pid),
        NEXTCLAW_EXTENSION_TOKEN: params.tokenForExtension(manifest.id),
      }, { inheritBaseEnv: true }),
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

  private cleanupOrphanProcesses = (manifests: ExtensionManifest[]): void => {
    if (this.options.cleanupOrphanProcesses) {
      this.options.cleanupOrphanProcesses(manifests);
      return;
    }
    if (process.platform === "win32" || process.env.NEXTCLAW_EXTENSION_ORPHAN_CLEANUP === "0") {
      return;
    }
    try {
      const roots = this.resolveManifestRoots(manifests);
      for (const snapshot of this.listOrphanNodeDistMainProcesses()) {
        const cwd = this.readProcessCwd(snapshot.pid);
        if (!cwd || !this.isNextClawChannelExtensionCwd(cwd, roots)) {
          continue;
        }
        try {
          process.kill(snapshot.pid, "SIGTERM");
          console.warn(`Stopped orphan extension process ${snapshot.pid} (${cwd}).`);
        } catch (error) {
          console.warn(
            `Failed to stop orphan extension process ${snapshot.pid}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    } catch (error) {
      console.warn(`Extension orphan cleanup skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  private resolveManifestRoots = (manifests: ExtensionManifest[]): Set<string> => {
    return new Set(manifests.map((manifest) => this.normalizePath(manifest.rootDir)));
  };

  private normalizePath = (value: string): string => {
    try {
      return realpathSync(value);
    } catch {
      return resolve(value);
    }
  };

  private listOrphanNodeDistMainProcesses = (): ProcessSnapshot[] => {
    const output = execFileSync("ps", ["-axo", "pid=,ppid=,command="], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    return output.split("\n")
      .map((line) => {
        const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
        if (!match) {
          return null;
        }
        return {
          pid: Number(match[1]),
          ppid: Number(match[2]),
          command: match[3] ?? "",
        };
      })
      .filter((snapshot): snapshot is ProcessSnapshot =>
        Boolean(snapshot && snapshot.ppid === 1 && this.isNodeDistMainCommand(snapshot.command))
      );
  };

  private isNodeDistMainCommand = (command: string): boolean => {
    return /(?:^|\s|\/)node(?:\.exe)?\s+dist\/main\.js(?:\s|$)/.test(command);
  };

  private readProcessCwd = (pid: number): string | null => {
    if (process.platform === "linux") {
      try {
        return this.normalizePath(readlinkSync(`/proc/${pid}/cwd`));
      } catch {
        return null;
      }
    }
    try {
      const output = execFileSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const cwd = output.split("\n").find((line) => line.startsWith("n"))?.slice(1).trim();
      return cwd ? this.normalizePath(cwd) : null;
    } catch {
      return null;
    }
  };

  private isNextClawChannelExtensionCwd = (cwd: string, roots: Set<string>): boolean => {
    if (roots.has(cwd)) {
      return true;
    }
    return /(?:^|\/)nextclaw-channel-extension-[^/]+$/.test(cwd)
      || /\/node_modules\/@nextclaw\/channel-extension-[^/]+$/.test(cwd)
      || /\/node_modules\/\.nextclaw-[^/]+\/node_modules\/@nextclaw\/channel-extension-[^/]+$/.test(cwd);
  };
}
