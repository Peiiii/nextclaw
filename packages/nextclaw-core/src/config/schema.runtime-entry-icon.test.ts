import { describe, expect, it } from "vitest";
import { ConfigSchema } from "./schema.js";

describe("ConfigSchema runtime entry icon", () => {
  it("preserves image icons declared on agent runtime entries", () => {
    const config = ConfigSchema.parse({
      agents: {
        runtimes: {
          entries: {
            hermes: {
              enabled: true,
              label: "Hermes",
              icon: {
                kind: "image",
                src: "app://runtime-icons/hermes-agent.png",
                alt: "Hermes",
              },
              type: "narp-stdio",
              config: {
                command: "hermes",
              },
            },
          },
        },
      },
    });

    expect(config.agents.runtimes.entries.hermes?.icon).toEqual({
      kind: "image",
      src: "app://runtime-icons/hermes-agent.png",
      alt: "Hermes",
    });
  });
});
