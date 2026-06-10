import { describe, expect, it } from "vitest";

import {
  describeAgentRuntimeSessionTypes,
  resolveAgentRuntimeEntries,
} from "./agent-runtime-registry.utils.js";

function createConfig(
  entries: Record<
    string,
    {
      enabled?: boolean;
      label?: string;
      type?: string;
      config?: Record<string, unknown>;
    }
  > = {},
) {
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
  it("does not synthesize runtime entries without explicit config", () => {
    const resolved = resolveAgentRuntimeEntries({
      config: createConfig(),
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

describe("describeAgentRuntimeSessionTypes", () => {
  it("describes entries through provider descriptors without owning runtime state", async () => {
    const listed = await describeAgentRuntimeSessionTypes({
      entries: [
        {
          id: "native",
          label: "Native",
          type: "native",
        },
        {
          id: "external",
          label: "External",
          type: "narp-stdio",
        },
      ],
      providers: new Map([
        ["native", {}],
        [
          "narp-stdio",
          {
            describeSessionTypeForEntry: ({ entry }) => ({
              recommendedModel: `${entry.id}-model`,
              modelSelectionMode: "runtime-default",
            }),
          },
        ],
      ]),
    });

    expect(listed).toEqual({
      defaultType: "native",
      options: [
        expect.objectContaining({
          value: "native",
          ready: true,
          modelSelectionMode: "nextclaw",
        }),
        expect.objectContaining({
          value: "external",
          ready: true,
          recommendedModel: "external-model",
          modelSelectionMode: "runtime-default",
        }),
      ],
    });
  });
});
