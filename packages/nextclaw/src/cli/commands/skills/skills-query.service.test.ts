import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SkillsQueryService } from "./skills-query.service.js";

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

function createWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-skills-query-"));
  cleanupDirs.push(workspace);
  return workspace;
}

function writeWorkspaceSkill(workspace: string, slug: string, body: string): void {
  const skillDir = join(workspace, "skills", slug);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), body);
}

describe("SkillsQueryService", () => {
  it("lists installed skills and keeps local and builtin scopes distinct", () => {
    const workspace = createWorkspace();
    writeWorkspaceSkill(
      workspace,
      "workspace-helper",
      [
        "---",
        "name: workspace-helper",
        "description: local helper",
        "summary: Workspace helper summary",
        "tags:",
        "  - local",
        "---",
        "",
        "Use this workspace helper.",
      ].join("\n"),
    );

    const service = new SkillsQueryService();
    const installed = service.listInstalled({ workdir: workspace, scope: "workspace" });

    expect(installed.workspace).toBe(workspace);
    expect(installed.skills).toEqual([
      expect.objectContaining({
        name: "workspace-helper",
        scope: "workspace",
        source: "workspace",
        summary: "Workspace helper summary",
        description: "local helper",
        tags: ["local"],
      }),
    ]);

    const builtinOnly = service.listInstalled({ workdir: workspace, scope: "builtin", query: "self-manage" });
    expect(builtinOnly.skills).toEqual([
      expect.objectContaining({
        name: "nextclaw-self-manage",
        scope: "builtin",
        source: "builtin",
        always: true,
      }),
    ]);
  });

  it("reads installed skill detail with body content", () => {
    const workspace = createWorkspace();
    writeWorkspaceSkill(
      workspace,
      "workspace-helper",
      [
        "---",
        "name: workspace-helper",
        "description: local helper",
        "summary: Workspace helper summary",
        "---",
        "",
        "## Steps",
        "",
        "1. Do thing",
      ].join("\n"),
    );

    const service = new SkillsQueryService();
    const detail = service.getInstalledInfo({ workdir: workspace, selector: "workspace-helper" });

    expect(detail.name).toBe("workspace-helper");
    expect(detail.metadata).toEqual(expect.objectContaining({ name: "workspace-helper" }));
    expect(detail.raw).toContain("Workspace helper summary");
    expect(detail.bodyRaw).toContain("## Steps");
  });

  it("queries marketplace search, info, and recommendations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("/api/v1/skills/items?")) {
          return new Response(JSON.stringify({
            ok: true,
            data: {
              total: 1,
              page: 1,
              pageSize: 20,
              totalPages: 1,
              sort: "relevance",
              query: "weather",
              items: [{
                id: "skill-weather",
                slug: "weather",
                type: "skill",
                name: "Weather",
                summary: "Weather lookup",
                summaryI18n: { en: "Weather lookup" },
                tags: ["weather"],
                author: "NextClaw",
                install: {
                  kind: "marketplace",
                  spec: "@nextclaw/weather",
                  command: "nextclaw marketplace skills install weather",
                },
                updatedAt: "2026-04-17T00:00:00.000Z",
              }],
            },
          }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        if (url.endsWith("/api/v1/skills/items/weather")) {
          return new Response(JSON.stringify({
            ok: true,
            data: {
              id: "skill-weather",
              slug: "weather",
              type: "skill",
              name: "Weather",
              summary: "Weather lookup",
              summaryI18n: { en: "Weather lookup" },
              description: "Detailed weather skill",
              descriptionI18n: { en: "Detailed weather skill" },
              tags: ["weather"],
              author: "NextClaw",
              install: {
                kind: "marketplace",
                spec: "@nextclaw/weather",
                command: "nextclaw marketplace skills install weather",
              },
              updatedAt: "2026-04-17T00:00:00.000Z",
              publishedAt: "2026-04-16T00:00:00.000Z",
            },
          }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        if (url.endsWith("/api/v1/skills/items/weather/content")) {
          return new Response(JSON.stringify({
            ok: true,
            data: {
              type: "skill",
              slug: "weather",
              name: "Weather",
              install: {
                kind: "marketplace",
                spec: "@nextclaw/weather",
                command: "nextclaw marketplace skills install weather",
              },
              source: "marketplace",
              raw: "---\nname: Weather\n---\nWeather content",
              metadataRaw: "{\n  \"name\": \"Weather\"\n}",
              bodyRaw: "Weather content",
              sourceUrl: "https://example.com/weather",
            },
          }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        if (url.includes("/api/v1/skills/recommendations")) {
          return new Response(JSON.stringify({
            ok: true,
            data: {
              type: "skill",
              sceneId: "skills-default",
              title: "Recommended Skills",
              description: "Curated",
              total: 1,
              items: [{
                id: "skill-weather",
                slug: "weather",
                type: "skill",
                name: "Weather",
                summary: "Weather lookup",
                summaryI18n: { en: "Weather lookup" },
                tags: ["weather"],
                author: "NextClaw",
                install: {
                  kind: "marketplace",
                  spec: "@nextclaw/weather",
                  command: "nextclaw marketplace skills install weather",
                },
                updatedAt: "2026-04-17T00:00:00.000Z",
              }],
            },
          }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          ok: false,
          error: { message: `unexpected url: ${url}` },
        }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    const service = new SkillsQueryService();
    const search = await service.searchMarketplaceSkills({ query: "weather", page: 1, pageSize: 20 });
    const info = await service.getMarketplaceSkillInfo({ slug: "weather" });
    const recommendations = await service.recommendMarketplaceSkills({ scene: "default", limit: 3 });

    expect(search.apiBaseUrl).toBe("https://marketplace-api.nextclaw.io");
    expect(search.items[0]?.slug).toBe("weather");
    expect(info.item.slug).toBe("weather");
    expect(info.content?.bodyRaw).toBe("Weather content");
    expect(recommendations.sceneId).toBe("skills-default");
    expect(recommendations.items[0]?.install.command).toContain("marketplace skills install weather");
  });
});
