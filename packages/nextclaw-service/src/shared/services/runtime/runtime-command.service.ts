import * as NextclawCore from "@nextclaw/core";
import { spawn } from "node:child_process";
import type { RequestRestartParams } from "@nextclaw-service/shared/types/cli.types.js";
import { ManagedServiceCommandService, type StartServiceOptions } from "@nextclaw-service/shared/services/runtime/service-managed-startup.service.js";
import { NextclawGatewayRuntime } from "@nextclaw-service/shared/services/gateway/nextclaw-gateway-runtime.service.js";
import { describeUnmanagedHealthyTargetMessage, inspectUiTarget } from "@nextclaw-service/shared/utils/service-port-probe.utils.js";
import { resolveCliSubcommandEntry } from "@nextclaw-service/shared/utils/marketplace/cli-subcommand-launch.utils.js";
import { isLoopbackHost, resolvePublicIp } from "@nextclaw-service/shared/utils/cli.utils.js";
import { createSkillsLoader } from "@nextclaw-service/shared/services/runtime/utils/skills-loader.utils.js";
export { buildMarketplaceSkillInstallArgs, pickUserFacingCommandSummary } from "@nextclaw-service/shared/utils/marketplace/service-marketplace-helpers.utils.js";
export { describeUnmanagedHealthyTargetMessage };
const {
  getWorkspacePath,
  loadConfig,
} = NextclawCore;
type Config = NextclawCore.Config;

export class RuntimeCommandService {
  private loggingInstalled = false;
  private readonly managedServiceCommandService = new ManagedServiceCommandService({
    startGateway: async (options) => await this.startGateway(options),
    printPublicUiUrls: async (host, port) => await this.printPublicUiUrls(host, port),
    printServiceControlHints: () => this.printServiceControlHints(),
    checkUiPortPreflight: async (params) => await this.checkUiPortPreflight(params)
  });

  constructor(private deps: {
    requestRestart: (params: RequestRestartParams) => Promise<void>;
    initializeAgentHomeDirectory: (homeDirectory: string) => void;
  }) {}

  startGateway = async (options: { uiOverrides?: Partial<Config["ui"]>; uiStaticDir?: string | null } = {}): Promise<void> => {
    this.ensureRuntimeLoggingInstalled();
    await new NextclawGatewayRuntime({
      requestRestart: this.deps.requestRestart,
      initializeAgentHomeDirectory: this.deps.initializeAgentHomeDirectory,
      startService: this.startService,
      stopService: this.stopService,
      runCliSubcommand: this.runCliSubcommand,
      installBuiltinMarketplaceSkill: this.installBuiltinMarketplaceSkill,
    }, options).start();
  };

  startService = async (options: StartServiceOptions): Promise<void> => {
    await this.managedServiceCommandService.startService(options);
  };

  stopService = async (): Promise<void> => {
    await this.managedServiceCommandService.stopService();
  };

  runForeground = async (options: {
    uiOverrides: Partial<Config["ui"]>;
    open: boolean;
  }): Promise<void> => {
    await this.managedServiceCommandService.runForeground(options);
  };

  private installBuiltinMarketplaceSkill = (slug: string, _force: boolean | undefined): { message: string; output?: string } | null => {
    const workspace = getWorkspacePath(loadConfig().agents.defaults.workspace);
    const loader = createSkillsLoader(workspace);
    const builtin = (loader?.listSkills(false) ?? []).find((skill) => skill.name === slug && skill.source === "builtin");

    if (!builtin) {
      return null;
    }
    return {
      message: `${slug} is already available (built-in)`
    };
  };

  private mergeCommandOutput = (stdout: string, stderr: string): string => {
    return `${stdout}\n${stderr}`.trim();
  };

  private runCliSubcommand = (args: string[], timeoutMs = 180_000): Promise<string> => {
    const cliEntry = resolveCliSubcommandEntry({
      argvEntry: process.argv[1],
      importMetaUrl: import.meta.url
    });
    return this.runCommand(process.execPath, [...process.execArgv, cliEntry, ...args], {
      cwd: process.cwd(),
      timeoutMs
    }).then((result) => this.mergeCommandOutput(result.stdout, result.stderr));
  };

  private runCommand = (command: string, args: string[], options: { cwd?: string; timeoutMs?: number } = {}): Promise<{ stdout: string; stderr: string }> => {
    const timeoutMs = options.timeoutMs ?? 180_000;
    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(command, args, {
        cwd: options.cwd ?? process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";
      child.stdout?.setEncoding("utf-8");
      child.stderr?.setEncoding("utf-8");
      child.stdout?.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr?.on("data", (chunk: string) => {
        stderr += chunk;
      });

      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        rejectPromise(new Error(`command timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.on("error", (error) => {
        clearTimeout(timer);
        rejectPromise(new Error(`failed to start command: ${String(error)}`));
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        const output = this.mergeCommandOutput(stdout, stderr);
        if (code === 0) {
          resolvePromise({ stdout, stderr });
          return;
        }
        rejectPromise(new Error(output || `command failed with code ${code ?? 1}`));
      });
    });
  };

  private ensureRuntimeLoggingInstalled = (): void => {
    if (this.loggingInstalled) {
      return;
    }
    NextclawCore.configureAppLogging({
      installConsoleMirror: true,
      installProcessCrashMonitor: true
    });
    this.loggingInstalled = true;
  };

  private checkUiPortPreflight = async (params: {
    host: string;
    port: number;
    healthUrl: string;
  }): Promise<
    | { ok: true; reusedExistingHealthyTarget: boolean }
    | { ok: false; message: string }
  > => {
    const target = await inspectUiTarget(params);
    if (target.state === "available") {
      return { ok: true, reusedExistingHealthyTarget: false };
    }
    if (target.state === "healthy-existing") {
      return { ok: true, reusedExistingHealthyTarget: true };
    }

    const lines = [`Port probe: ${target.availabilityDetail}`];
    if (target.probeError) {
      lines.push(`Health probe: ${target.probeError}`);
    }
    lines.push("The port is occupied by a process that does not answer as a healthy NextClaw HTTP server.");
    lines.push(`Fix: free port ${params.port} or start NextClaw with another port via --ui-port <port>.`);
    lines.push(`Inspect locally with: ss -ltnp | grep ${params.port} || lsof -iTCP:${params.port} -sTCP:LISTEN -n -P`);
    return {
      ok: false,
      message: lines.join("\n")
    };
  };

  private printPublicUiUrls = async (host: string, port: number): Promise<void> => {
    if (isLoopbackHost(host)) {
      console.log("Public URL: disabled (UI host is loopback). Current release expects public exposure; run nextclaw restart.");
      return;
    }

    const publicIp = await resolvePublicIp();
    if (!publicIp) {
      console.log("Public URL: UI is exposed, but automatic public IP detection failed.");
      return;
    }

    const publicBase = `http://${publicIp}:${port}`;
    console.log(`Public UI (if firewall/NAT allows): ${publicBase}`);
    console.log(`Public API (if firewall/NAT allows): ${publicBase}/api`);
    console.log(`Public deploy note: NextClaw serves plain HTTP on ${port}.`);
    console.log(`For https:// or standard 80/443 access, terminate TLS in Nginx/Caddy and proxy to http://127.0.0.1:${port}.`);
    console.log(`If a reverse proxy returns 502, verify its upstream is http://127.0.0.1:${port} (not https://, not a stale port, and not a stopped process).`);
  };

  private printServiceControlHints = (): void => {
    console.log("Service controls:");
    console.log("  - Check status: NextClaw status");
    console.log("  - If you need to stop the service, run: NextClaw stop");
    console.log("  - View log paths: NextClaw logs path");
    console.log("  - Tail recent logs: NextClaw logs tail");
    console.log("  - Check autostart: NextClaw service autostart status --user");
  };
}
