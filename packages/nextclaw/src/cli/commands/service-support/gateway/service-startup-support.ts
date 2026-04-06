import type { startPluginChannelGateways } from "@nextclaw/openclaw-compat";
import type { RemoteServiceModule } from "@nextclaw/remote";
import chokidar from "chokidar";
import { resolve } from "node:path";

export const pluginGatewayLogger = {
  info: (message: string) => console.log(`[plugins] ${message}`),
  warn: (message: string) => console.warn(`[plugins] ${message}`),
  error: (message: string) => console.error(`[plugins] ${message}`),
  debug: (message: string) => console.debug(`[plugins] ${message}`)
};

export function logPluginGatewayDiagnostics(
  diagnostics: Awaited<ReturnType<typeof startPluginChannelGateways>>["diagnostics"]
): void {
  for (const diag of diagnostics) {
    const prefix = diag.pluginId ? `${diag.pluginId}: ` : "";
    const text = `${prefix}${diag.message}`;
    if (diag.level === "error") {
      console.error(`[plugins] ${text}`);
    } else {
      console.warn(`[plugins] ${text}`);
    }
  }
}

export async function startGatewaySupportServices(params: {
  cronJobs: number;
  remoteModule: RemoteServiceModule | null;
  watchConfigFile: () => void;
  startCron: () => Promise<void>;
  startHeartbeat: () => Promise<void>;
}): Promise<void> {
  if (params.cronJobs > 0) {
    console.log(`✓ Cron: ${params.cronJobs} scheduled jobs`);
  }
  console.log("✓ Heartbeat: every 30m");
  params.remoteModule?.start();
  params.watchConfigFile();
  await params.startCron();
  await params.startHeartbeat();
}

export function watchCronStoreFile(params: {
  cronStorePath: string;
  reloadCronStore: () => void;
}): void {
  const cronStorePath = resolve(params.cronStorePath);
  const watcher = chokidar.watch(cronStorePath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 }
  });
  watcher.on("all", (event, changedPath) => {
    if (resolve(changedPath) !== cronStorePath) {
      return;
    }
    if (event === "add" || event === "change" || event === "unlink") {
      try {
        params.reloadCronStore();
      } catch (error) {
        console.error(`Cron store reload failed (${event}): ${String(error)}`);
      }
    }
  });
}
