import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { EventBus } from "@nextclaw/shared";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-provider-meta-catalog-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

type ProviderMeta = {
  id: string;
  providerType: string;
  displayName?: string;
  envKey?: string;
  defaultApiBase?: string;
  defaultModels?: string[];
  supportsWireApi?: boolean;
  defaultWireApi?: "auto" | "chat" | "responses";
  auth?: {
    kind: string;
    defaultMethodId?: string;
    supportsCliImport?: boolean;
    methods?: Array<{ id: string }>;
  };
};

async function loadProviderMeta(): Promise<ProviderMeta[]> {
  const configPath = createTempConfigPath();
  saveConfig(ConfigSchema.parse({}), configPath);

  const app = createUiRouter({
    kernel: createRouterTestKernel(),
    configPath,
    appEventBus: new EventBus(),
  });

  const metaResponse = await app.request("http://localhost/api/provider-templates");
  expect(metaResponse.status).toBe(200);
  const metaPayload = (await metaResponse.json()) as {
      ok: true;
      data: {
      providerTemplates: ProviderMeta[];
    };
  };
  return metaPayload.data.providerTemplates;
}

describe("provider meta catalog", () => {
  it("exposes qwen-portal auth metadata in provider meta", async () => {
    const providers = await loadProviderMeta();
    const qwenPortal = providers.find(
      (provider) => provider.providerType === "qwen-portal",
    );
    expect(qwenPortal).toBeDefined();
    expect(qwenPortal?.auth?.kind).toBe("device_code");
    expect(qwenPortal?.auth?.supportsCliImport).toBe(true);
  });

  it("exposes minimax-portal auth methods in provider meta", async () => {
    const providers = await loadProviderMeta();
    const minimaxPortal = providers.find(
      (provider) => provider.providerType === "minimax-portal",
    );
    expect(minimaxPortal).toBeDefined();
    expect(minimaxPortal?.auth?.kind).toBe("device_code");
    expect(minimaxPortal?.auth?.defaultMethodId).toBe("cn");
    expect(minimaxPortal?.auth?.methods?.map((method) => method.id)).toEqual([
      "global",
      "cn",
    ]);
  });

  it("exposes minimax model defaults in provider meta", async () => {
    const providers = await loadProviderMeta();
    const minimax = providers.find((provider) => provider.providerType === "minimax");
    expect(minimax).toBeDefined();
    expect(minimax?.defaultModels).toEqual([
      "minimax/MiniMax-M3",
      "minimax/MiniMax-M2.7",
      "minimax/MiniMax-M2.7-highspeed",
    ]);
    expect(minimax?.supportsWireApi).toBe(true);
    expect(minimax?.defaultWireApi).toBe("chat");
  });

  it("exposes dashscope coding plan as a dedicated provider in meta", async () => {
    const providers = await loadProviderMeta();
    const codingPlan = providers.find(
      (provider) => provider.providerType === "dashscope-coding-plan",
    );
    expect(codingPlan).toBeDefined();
    expect(codingPlan?.displayName).toBe("DashScope Coding Plan");
    expect(codingPlan?.envKey).toBe("DASHSCOPE_CODING_PLAN_API_KEY");
    expect(codingPlan?.defaultApiBase).toBe(
      "https://coding.dashscope.aliyuncs.com/v1",
    );
    expect(codingPlan?.defaultModels).toEqual([
      "dashscope-coding-plan/qwen3.7-plus",
      "dashscope-coding-plan/qwen3.7-max",
      "dashscope-coding-plan/qwen3-max-2026-01-23",
      "dashscope-coding-plan/qwen3-coder-next",
      "dashscope-coding-plan/qwen3-coder-plus",
      "dashscope-coding-plan/MiniMax-M3",
      "dashscope-coding-plan/MiniMax-M2.5",
      "dashscope-coding-plan/glm-5.1",
      "dashscope-coding-plan/glm-5",
      "dashscope-coding-plan/glm-4.7",
      "dashscope-coding-plan/kimi-k2.6",
      "dashscope-coding-plan/kimi-k2.5",
    ]);
  });

  it("exposes kimi coding as a dedicated provider in meta", async () => {
    const providers = await loadProviderMeta();
    const kimiCoding = providers.find(
      (provider) => provider.providerType === "kimi-coding",
    );
    expect(kimiCoding).toBeDefined();
    expect(kimiCoding?.displayName).toBe("Kimi Coding");
    expect(kimiCoding?.envKey).toBe("KIMI_CODING_API_KEY");
    expect(kimiCoding?.defaultApiBase).toBe("https://api.kimi.com/coding");
    expect(kimiCoding?.defaultModels).toEqual(["kimi-coding/kimi-for-coding"]);
  });
});
