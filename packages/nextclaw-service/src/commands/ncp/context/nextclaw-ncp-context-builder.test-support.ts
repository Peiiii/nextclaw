import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConfigSchema, type Config } from "@nextclaw/core";

type TestConfigOverrides = {
  agents?: Record<string, unknown>;
  providers?: Record<string, unknown>;
  [key: string]: unknown;
};

const OPENAI_TEST_PROVIDER = {
  openai: {
    enabled: true,
    apiKey: "test-openai-key",
    models: ["gpt-5.4"],
  },
} as const;

export function createNcpTestConfig(
  workspace: string,
  defaults?: Partial<Config["agents"]["defaults"]>,
  overrides?: TestConfigOverrides,
): Config {
  const { agents: agentOverrides, providers: providerOverrides, ...restOverrides } =
    overrides ?? {};
  return ConfigSchema.parse({
    agents: {
      defaults: {
        workspace,
        model: "gpt-5.4",
        contextTokens: 200000,
        maxToolIterations: 8,
        ...defaults,
      },
      ...(agentOverrides ?? {}),
    },
    providers: {
      ...OPENAI_TEST_PROVIDER,
      ...(providerOverrides ?? {}),
    },
    ...restOverrides,
  });
}

export function writeSkillFixture(params: {
  rootDir: string;
  skillName: string;
  description: string;
  body: string;
}): string {
  const { rootDir, skillName, description, body } = params;
  const skillDir = join(rootDir, skillName);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, "SKILL.md"),
    [
      "---",
      `name: ${skillName}`,
      `description: ${description}`,
      "---",
      "",
      body,
    ].join("\n"),
  );
  return skillDir;
}
