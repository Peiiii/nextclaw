import type { CompanionAppOptions } from "./types/companion-shell.types.js";
import { CompanionApplicationService } from "./services/companion-application.service.js";

function resolveBaseUrl(argv: string[]): string {
  const baseUrlFromCli = argv.find((value) => value.startsWith("--base-url="));
  if (baseUrlFromCli) {
    return baseUrlFromCli.slice("--base-url=".length);
  }
  const baseUrlFlagIndex = argv.findIndex((value) => value === "--base-url");
  if (baseUrlFlagIndex >= 0 && argv[baseUrlFlagIndex + 1]) {
    return argv[baseUrlFlagIndex + 1];
  }
  return process.env.NEXTCLAW_COMPANION_BASE_URL?.trim() || "http://127.0.0.1:55667";
}

async function main(): Promise<void> {
  const options: CompanionAppOptions = {
    baseUrl: resolveBaseUrl(process.argv.slice(1)),
    runtimeStatePath: process.env.NEXTCLAW_COMPANION_RUNTIME_STATE_PATH?.trim() || undefined
  };
  await new CompanionApplicationService(options).run();
}

void main();
