import { describe, expect, it, vi } from "vitest";

vi.mock("@nextclaw/core", () => ({
  toDisposable: (dispose: () => void) => ({ dispose }),
}));

import { resolveAgentRuntimeEntries } from "./agent-runtime-registry.service.js";

function createConfig(entries: Record<string, {
  enabled?: boolean;
  label?: string;
  type?: string;
  config?: Record<string, unknown>;
}> = {}) {
  return {
    ui: {},
    agents: {
      runtimes: {
        entries,
      },
    },
  };
}

describe("resolveAgentRuntimeEntries", () => {
  it("does not synthesize provider-specific runtime entries from plugin provider kinds", () => {
    const resolved = resolveAgentRuntimeEntries({
      config: createConfig(),
      providerKinds: ["external-provider"],
    });

    expect(resolved.entries.map((entry) => entry.id)).toEqual(["native"]);
  });

  it("preserves explicit runtime entry overrides", () => {
    const resolved = resolveAgentRuntimeEntries({
      config: createConfig({
        external: {
          enabled: true,
          label: "External Runtime",
          type: "narp-stdio",
          config: {
            wireDialect: "acp",
            command: "/opt/nextclaw/external-narp",
          },
        },
      }),
      providerKinds: [],
    });

    expect(resolved.entries.find((entry) => entry.id === "external")).toEqual(
      expect.objectContaining({
        label: "External Runtime",
        type: "narp-stdio",
        config: {
          wireDialect: "acp",
          command: "/opt/nextclaw/external-narp",
        },
      }),
    );
  });
});
