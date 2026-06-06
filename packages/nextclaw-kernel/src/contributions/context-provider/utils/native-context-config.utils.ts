import type { Config } from "@nextclaw/core";

type ContextConfig = Config["agents"]["context"];

export const DEFAULT_NATIVE_CONTEXT_CONFIG: ContextConfig = {
  bootstrap: {
    files: [
      "AGENTS.md",
      "SOUL.md",
      "USER.md",
      "IDENTITY.md",
      "TOOLS.md",
      "BOOT.md",
      "BOOTSTRAP.md",
    ],
    minimalFiles: ["AGENTS.md", "SOUL.md", "TOOLS.md", "IDENTITY.md"],
    perFileChars: 4000,
    totalChars: 12000,
  },
  memory: {
    enabled: true,
    maxChars: 8000,
  },
};

export function mergeNativeContextConfig(
  contextConfig?: ContextConfig,
): ContextConfig {
  return {
    bootstrap: {
      ...DEFAULT_NATIVE_CONTEXT_CONFIG.bootstrap,
      ...(contextConfig?.bootstrap ?? {}),
    },
    memory: {
      ...DEFAULT_NATIVE_CONTEXT_CONFIG.memory,
      ...(contextConfig?.memory ?? {}),
    },
  };
}
