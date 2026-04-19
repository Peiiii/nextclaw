import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publishMarketplaceSkill } from "./marketplace.js";

const cleanupDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop();
    if (!dir) {
      continue;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

function createTempSkillDir(skillMarkdown: string, metadataJson?: string): string {
  const root = mkdtempSync(join(tmpdir(), "nextclaw-marketplace-publish-"));
  cleanupDirs.push(root);
  writeFileSync(join(root, "SKILL.md"), skillMarkdown);
  if (metadataJson) {
    writeFileSync(join(root, "marketplace.json"), metadataJson);
  }
  return root;
}

describe("publishMarketplaceSkill", () => {
  it("reads localized marketplace metadata from marketplace.json", async () => {
    let capturedBody: Record<string, unknown> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return new Response(JSON.stringify({
          ok: true,
          data: {
            created: true,
            fileCount: 1
          }
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );

    const skillDir = createTempSkillDir(`---
name: humanizer
summary: English summary
description: English description
author: NextClaw
---

# Humanizer
`, JSON.stringify({
      name: "Humanizer",
      summary: "Marketplace English summary",
      summaryI18n: {
        zh: "中文摘要",
        ja: "日本語の要約"
      },
      description: "Marketplace English description",
      descriptionI18n: {
        zh: "中文描述"
      },
      author: "Marketplace Team",
      tags: ["writing", "editing"]
    }, null, 2));

    await publishMarketplaceSkill({
      skillDir,
      slug: "humanizer",
      packageName: "@nextclaw/humanizer",
      apiBaseUrl: "https://marketplace-api.nextclaw.io",
      token: "admin-token"
    });

    expect(capturedBody?.packageName).toBe("@nextclaw/humanizer");
    expect(capturedBody?.name).toBe("Humanizer");
    expect(capturedBody?.summary).toBe("Marketplace English summary");
    expect(capturedBody?.summaryI18n).toEqual({
      en: "Marketplace English summary",
      zh: "中文摘要",
      ja: "日本語の要約"
    });
    expect(capturedBody?.descriptionI18n).toEqual({
      en: "Marketplace English description",
      zh: "中文描述"
    });
    expect(capturedBody?.tags).toEqual(["writing", "editing"]);
  });

  it("falls back to multiline SKILL.md frontmatter when marketplace.json is absent", async () => {
    let capturedBody: Record<string, unknown> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return new Response(JSON.stringify({
          ok: true,
          data: {
            created: false,
            fileCount: 1
          }
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );

    const skillDir = createTempSkillDir(`---
name: humanizer
summary: English summary
summary_zh: 中文摘要
description: |
  First line.
  Second line.
description_i18n:
  zh: 中文描述
author: NextClaw
tags:
  - writing
  - editing
---

# Humanizer
`);

    await publishMarketplaceSkill({
      skillDir,
      slug: "humanizer",
      packageName: "@nextclaw/humanizer",
      apiBaseUrl: "https://marketplace-api.nextclaw.io",
      token: "admin-token"
    });

    expect(capturedBody?.packageName).toBe("@nextclaw/humanizer");
    expect(capturedBody?.summary).toBe("English summary");
    expect(capturedBody?.summaryI18n).toEqual({
      en: "English summary",
      zh: "中文摘要"
    });
    expect(capturedBody?.description).toBe("First line.\nSecond line.");
    expect(capturedBody?.descriptionI18n).toEqual({
      en: "First line.\nSecond line.",
      zh: "中文描述"
    });
    expect(capturedBody?.tags).toEqual(["writing", "editing"]);
  });
});
