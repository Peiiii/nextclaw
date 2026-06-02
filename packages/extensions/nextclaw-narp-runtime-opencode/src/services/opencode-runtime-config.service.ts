import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NarpStdioRuntimeWrapperContext } from "@nextclaw/nextclaw-narp-stdio-runtime-wrapper";
import type { OpencodeAcpRuntimeConfig } from "@opencode-narp/types/opencode-narp-runtime.types.js";
import {
  readString,
  resolveOpencodeProviderNpm,
  resolveOpencodeRoute,
} from "@opencode-narp/utils/opencode-provider-route.utils.js";

const DEFAULT_OPENCODE_COMMAND = "opencode";
const DEFAULT_REQUEST_TIMEOUT_MS = 240_000;
const DEFAULT_STARTUP_TIMEOUT_MS = 15_000;
const OPENCODE_CONFIG_SCHEMA = "https://opencode.ai/config.json";

export class OpencodeRuntimeConfigService {
  resolve = async (
    context: NarpStdioRuntimeWrapperContext,
  ): Promise<OpencodeAcpRuntimeConfig> => {
    const { cwd, modelId, promptMeta, sessionId } = context;
    const sessionMetadata = promptMeta.sessionMetadata ?? {};
    const route = resolveOpencodeRoute({
      modelId,
      providerRoute: promptMeta.providerRoute,
      sessionMetadata,
    });
    const sessionRoot = join(this.resolveRuntimeRoot(), sanitizePathSegment(sessionId));
    const homeDir = join(sessionRoot, "home");
    const configPath = join(sessionRoot, "opencode.json");
    const env = this.buildEnv({
      apiKey: route.apiKey,
      configPath,
      headers: route.headers,
      homeDir,
    });

    await mkdir(sessionRoot, { recursive: true });
    await mkdir(homeDir, { recursive: true });
    await writeFile(
      configPath,
      `${JSON.stringify({
        $schema: OPENCODE_CONFIG_SCHEMA,
        autoupdate: false,
        model: route.modelRoute,
        small_model: route.modelRoute,
        enabled_providers: [route.providerId],
        provider: {
          [route.providerId]: {
            npm: resolveOpencodeProviderNpm(route.apiMode),
            ...(this.resolveOpencodeApi(route.apiMode) ? { api: this.resolveOpencodeApi(route.apiMode) } : {}),
            name: `NextClaw ${route.providerId}`,
            options: {
              ...(route.apiBase ? { baseURL: route.apiBase } : {}),
              apiKey: "{env:NEXTCLAW_OPENCODE_API_KEY}",
              ...(route.apiMode === "chat_completions" ? { disableMaxOutputTokens: true } : {}),
              ...(route.headers ? { headers: this.buildHeaderConfig(route.headers) } : {}),
            },
            models: {
              [route.modelId]: {
                name: route.modelId,
              },
            },
          },
        },
      }, null, 2)}\n`,
      "utf8",
    );

    return {
      args: ["acp", "--pure", "--cwd", cwd ?? process.cwd()],
      command:
        readString(sessionMetadata.opencode_command) ??
        readString(process.env.NEXTCLAW_OPENCODE_COMMAND) ??
        DEFAULT_OPENCODE_COMMAND,
      cwd: cwd ?? process.cwd(),
      env,
      providerRoute: route.providerRoute,
      requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
      sessionId,
      startupTimeoutMs: DEFAULT_STARTUP_TIMEOUT_MS,
    };
  };

  private resolveRuntimeRoot = (): string =>
    readString(process.env.NEXTCLAW_OPENCODE_NARP_HOME) ??
    join(tmpdir(), "nextclaw-opencode-narp");

  private buildEnv = (params: {
    apiKey: string;
    configPath: string;
    headers?: Record<string, string>;
    homeDir: string;
  }): Record<string, string> => {
    const { apiKey, configPath, headers, homeDir } = params;
    const env: Record<string, string> = {
      HOME: homeDir,
      NEXTCLAW_OPENCODE_API_KEY: apiKey,
      OPENCODE_CONFIG: configPath,
    };
    for (const [index, value] of Object.values(headers ?? {}).entries()) {
      env[`NEXTCLAW_OPENCODE_HEADER_${index}`] = value;
    }
    return env;
  };

  private buildHeaderConfig = (
    headers: Record<string, string>,
  ): Record<string, string> => {
    const entries = Object.keys(headers).map((key, index) => [
      key,
      `{env:NEXTCLAW_OPENCODE_HEADER_${index}}`,
    ]);
    return Object.fromEntries(entries);
  };

  private resolveOpencodeApi = (apiMode: string): string | undefined => {
    if (apiMode === "codex_responses") {
      return "responses";
    }
    if (apiMode === "chat_completions") {
      return "chat";
    }
    return undefined;
  };
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "session";
}
