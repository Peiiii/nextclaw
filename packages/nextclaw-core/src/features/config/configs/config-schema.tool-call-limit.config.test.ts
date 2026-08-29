import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema } from "./config-schema.config.js";
import { loadConfig } from "@core/features/config/utils/config-loader.utils.js";

describe("ConfigSchema tool call limit", () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("drops retired global and per-agent tool call limit fields", () => {
    const config = ConfigSchema.parse({
      agents: {
        defaults: { maxToolIterations: 20 },
        list: [{ id: "main", maxToolIterations: 20 }],
      },
    });

    expect(config.agents.defaults).not.toHaveProperty("maxToolIterations");
    expect(config.agents.list[0]).not.toHaveProperty("maxToolIterations");
  });

  it("ignores retired values loaded from disk without migrating the file", () => {
    const directory = mkdtempSync(join(tmpdir(), "nextclaw-fixed-tool-call-limit-"));
    directories.push(directory);
    const configPath = join(directory, "config.json");
    const rawConfig = ConfigSchema.parse({
      agents: { list: [{ id: "main" }] },
      providers: {
        nextclaw: { apiKey: "existing-key" },
      },
    }) as Record<string, unknown>;
    const agents = rawConfig.agents as {
      defaults: Record<string, unknown>;
      list: Record<string, unknown>[];
    };
    agents.defaults.maxToolIterations = 20;
    agents.list[0].maxToolIterations = 20;
    writeFileSync(configPath, JSON.stringify(rawConfig));

    const config = loadConfig(configPath);

    expect(config.agents.defaults).not.toHaveProperty("maxToolIterations");
    expect(config.agents.list[0]).not.toHaveProperty("maxToolIterations");
    expect(JSON.parse(readFileSync(configPath, "utf8"))).toEqual(rawConfig);
  });
});
