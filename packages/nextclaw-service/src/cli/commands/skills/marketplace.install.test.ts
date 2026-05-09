import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installMarketplaceSkill } from "./marketplace.service.js";

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

function createTempWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "nextclaw-marketplace-install-"));
  cleanupDirs.push(root);
  return root;
}

function stubMarketplaceFetch(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/api/v1/skills/items/agent-browser")) {
        return new Response(JSON.stringify({
          ok: true,
          data: {
            install: {
              kind: "marketplace"
            }
          }
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.endsWith("/api/v1/skills/items/agent-browser/files")) {
        return new Response(JSON.stringify({
          ok: true,
          data: {
            files: [{
              path: "SKILL.md",
              contentBase64: Buffer.from("# agent-browser\n").toString("base64")
            }]
          }
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(JSON.stringify({
        ok: false,
        error: { message: `unexpected url: ${url}` }
      }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    })
  );
}

describe("installMarketplaceSkill", () => {
  it("recovers from an empty leftover directory", async () => {
    const workspace = createTempWorkspace();
    const destinationDir = join(workspace, "skills", "agent-browser");
    mkdirSync(destinationDir, { recursive: true });
    stubMarketplaceFetch();

    const result = await installMarketplaceSkill({
      slug: "agent-browser",
      workdir: workspace,
      apiBaseUrl: "https://marketplace-api.nextclaw.io"
    });

    expect(result.alreadyInstalled).toBeUndefined();
    expect(existsSync(join(destinationDir, "SKILL.md"))).toBe(true);
    expect(readFileSync(join(destinationDir, "SKILL.md"), "utf8")).toContain("agent-browser");
  });

  it("keeps refusing directories that contain unrelated files", async () => {
    const workspace = createTempWorkspace();
    const destinationDir = join(workspace, "skills", "agent-browser");
    mkdirSync(destinationDir, { recursive: true });
    writeFileSync(join(destinationDir, "custom.txt"), "do not overwrite");
    stubMarketplaceFetch();

    await expect(() => installMarketplaceSkill({
      slug: "agent-browser",
      workdir: workspace,
      apiBaseUrl: "https://marketplace-api.nextclaw.io"
    })).rejects.toThrow(`Skill directory already exists: ${destinationDir} (use --force)`);
  });

  it("retries when the first marketplace fetch fails with ECONNRESET", async () => {
    const workspace = createTempWorkspace();
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        calls += 1;
        if (url.endsWith("/api/v1/skills/items/agent-browser") && calls === 1) {
          const err = new TypeError("fetch failed");
          (err as Error & { cause?: unknown }).cause = Object.assign(new Error("read ECONNRESET"), {
            code: "ECONNRESET",
            errno: -54,
            syscall: "read"
          });
          throw err;
        }
        if (url.endsWith("/api/v1/skills/items/agent-browser")) {
          return new Response(JSON.stringify({
            ok: true,
            data: {
              install: {
                kind: "marketplace"
              }
            }
          }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        if (url.endsWith("/api/v1/skills/items/agent-browser/files")) {
          return new Response(JSON.stringify({
            ok: true,
            data: {
              files: [{
                path: "SKILL.md",
                contentBase64: Buffer.from("# agent-browser\n").toString("base64")
              }]
            }
          }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        return new Response(JSON.stringify({
          ok: false,
          error: { message: `unexpected url: ${url}` }
        }), {
          status: 404,
          headers: { "content-type": "application/json" }
        });
      })
    );

    const result = await installMarketplaceSkill({
      slug: "agent-browser",
      workdir: workspace,
      apiBaseUrl: "https://marketplace-api.nextclaw.io"
    });

    expect(result.slug).toBe("agent-browser");
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(existsSync(join(workspace, "skills", "agent-browser", "SKILL.md"))).toBe(true);
  });
});
