import { describe, expect, it } from "vitest";
import { ConfigSchema } from "@nextclaw/core";
import { resolveUiNcpRuntimeEntries } from "./ui-ncp-runtime-entry-resolver.js";

describe("resolveUiNcpRuntimeEntries", () => {
  it("assigns builtin presentation metadata to codex and claude runtime entries", () => {
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace: "/tmp/nextclaw-runtime-entry-resolver",
          model: "openai/gpt-5",
        },
      },
    });

    const resolvedEntries = resolveUiNcpRuntimeEntries({
      config,
      providerKinds: ["codex", "claude"],
    });

    expect(resolvedEntries.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "codex",
          icon: {
            kind: "image",
            src: "app://runtime-icons/codex-openai.svg",
            alt: "Codex",
          },
        }),
        expect.objectContaining({
          id: "claude",
          icon: {
            kind: "image",
            src: "app://runtime-icons/claude.ico",
            alt: "Claude",
          },
        }),
      ]),
    );
  });

  it("defaults hermes runtime entries to the builtin Hermes icon when config does not declare one", () => {
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace: "/tmp/nextclaw-runtime-entry-resolver",
          model: "openai/gpt-5",
        },
        runtimes: {
          entries: {
            hermes: {
              type: "narp-stdio",
              config: {
                command: "hermes",
              },
            },
          },
        },
      },
    });

    const resolvedEntries = resolveUiNcpRuntimeEntries({
      config,
      providerKinds: [],
    });

    expect(resolvedEntries.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "hermes",
          label: "Hermes",
          icon: {
            kind: "image",
            src: "app://runtime-icons/hermes-agent.png",
            alt: "Hermes",
          },
        }),
      ]),
    );
  });
});
