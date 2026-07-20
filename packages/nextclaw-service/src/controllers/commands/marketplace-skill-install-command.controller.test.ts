import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installMarketplaceSkill,
  updateInstalledMarketplaceSkill
} from "@nextclaw-service/utils/marketplace/marketplace.utils.js";

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
            },
            updatedAt: "2026-06-01T00:00:00.000Z"
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
    expect(existsSync(join(destinationDir, ".nextclaw-install.json"))).toBe(true);
    expect(readFileSync(join(destinationDir, "SKILL.md"), "utf8")).toContain("agent-browser");
  });

  it("reports and applies marketplace updates for tracked installs", async () => {
    const workspace = createTempWorkspace();
    const skillBodyByVersion = new Map([
      ["2026-06-01T00:00:00.000Z", "# agent-browser\nold"],
      ["2026-06-02T00:00:00.000Z", "# agent-browser\nnew"],
    ]);
    let updatedAt = "2026-06-01T00:00:00.000Z";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/api/v1/skills/items/agent-browser")) {
          return new Response(JSON.stringify({
            ok: true,
            data: {
              slug: "agent-browser",
              packageName: "@nextclaw/agent-browser",
              updatedAt,
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
                contentBase64: Buffer.from(skillBodyByVersion.get(updatedAt) ?? "").toString("base64")
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

    await installMarketplaceSkill({
      slug: "agent-browser",
      workdir: workspace,
      apiBaseUrl: "https://marketplace-api.nextclaw.io"
    });
    updatedAt = "2026-06-02T00:00:00.000Z";
    const update = await updateInstalledMarketplaceSkill({
      slug: "agent-browser",
      workdir: workspace,
      apiBaseUrl: "https://marketplace-api.nextclaw.io"
    });

    expect(update.updated).toBe(true);
    expect(readFileSync(join(workspace, "skills", "agent-browser", "SKILL.md"), "utf8")).toContain("new");
    expect(JSON.parse(readFileSync(join(workspace, "skills", "agent-browser", ".nextclaw-install.json"), "utf8"))).toEqual(
      expect.objectContaining({
        slug: "agent-browser",
        packageName: "@nextclaw/agent-browser",
        marketplaceUpdatedAt: "2026-06-02T00:00:00.000Z",
      })
    );
  });

  it("refuses to update locally modified marketplace skills without force", async () => {
    const workspace = createTempWorkspace();
    stubMarketplaceFetch();
    await installMarketplaceSkill({
      slug: "agent-browser",
      workdir: workspace,
      apiBaseUrl: "https://marketplace-api.nextclaw.io"
    });
    writeFileSync(join(workspace, "skills", "agent-browser", "SKILL.md"), "# custom local edit\n");

    await expect(() => updateInstalledMarketplaceSkill({
      slug: "agent-browser",
      workdir: workspace,
      apiBaseUrl: "https://marketplace-api.nextclaw.io",
    })).rejects.toThrow("Local skill files changed since install: agent-browser; use --force to overwrite local changes.");
  });
});

describe("updateInstalledMarketplaceSkill failure safety", () => {
  it("keeps the current install when an update blob download fails", async () => {
    const workspace = createTempWorkspace();
    let updatedAt = "2026-06-01T00:00:00.000Z";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/api/v1/skills/items/agent-browser")) {
          return new Response(JSON.stringify({
            ok: true,
            data: {
              slug: "agent-browser",
              updatedAt,
              install: { kind: "marketplace" }
            }
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (url.endsWith("/api/v1/skills/items/agent-browser/files")) {
          const files = updatedAt === "2026-06-01T00:00:00.000Z"
            ? [{ path: "SKILL.md", contentBase64: Buffer.from("# old\n").toString("base64") }]
            : [
                { path: "SKILL.md", contentBase64: Buffer.from("# new\n").toString("base64") },
                {
                  path: "scripts/run.mjs",
                  downloadPath: "/api/v1/skills/items/agent-browser/files/blob?path=scripts%2Frun.mjs"
                }
              ];
          return new Response(JSON.stringify({ ok: true, data: { files } }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        if (url.includes("/files/blob")) {
          throw new DOMException("update blob timed out", "TimeoutError");
        }
        return new Response(null, { status: 404 });
      })
    );

    await installMarketplaceSkill({
      slug: "agent-browser",
      workdir: workspace,
      apiBaseUrl: "https://marketplace-api.nextclaw.io"
    });
    updatedAt = "2026-06-02T00:00:00.000Z";

    await expect(() => updateInstalledMarketplaceSkill({
      slug: "agent-browser",
      workdir: workspace,
      apiBaseUrl: "https://marketplace-api.nextclaw.io"
    })).rejects.toThrow("update blob timed out");

    const destinationDir = join(workspace, "skills", "agent-browser");
    expect(readFileSync(join(destinationDir, "SKILL.md"), "utf8")).toBe("# old\n");
    expect(existsSync(join(destinationDir, "scripts", "run.mjs"))).toBe(false);
    expect(readdirSync(join(workspace, "skills")).filter((entry) => entry.startsWith(".agent-browser-install-"))).toEqual([]);
  });
});

describe("installMarketplaceSkill conflicts and retries", () => {
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

describe("installMarketplaceSkill source fallback", () => {
  it("falls back to the official source when the default domestic read source fails", async () => {
    const workspace = createTempWorkspace();
    const requestedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        requestedUrls.push(url);
        if (url.startsWith("https://api.nextclaw.net/")) {
          return new Response(JSON.stringify({
            ok: false,
            error: { message: "mirror unavailable" }
          }), {
            status: 502,
            headers: { "content-type": "application/json" }
          });
        }

        if (url.endsWith("/api/v1/skills/items/agent-browser")) {
          return new Response(JSON.stringify({
            ok: true,
            data: {
              install: {
                kind: "marketplace"
              },
              updatedAt: "2026-06-01T00:00:00.000Z"
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
      workdir: workspace
    });

    expect(result.slug).toBe("agent-browser");
    expect(existsSync(join(workspace, "skills", "agent-browser", "SKILL.md"))).toBe(true);
    expect(requestedUrls).toEqual([
      "https://api.nextclaw.net/api/v1/skills/items/agent-browser",
      "https://marketplace-api.nextclaw.io/api/v1/skills/items/agent-browser",
      "https://api.nextclaw.net/api/v1/skills/items/agent-browser/files",
      "https://marketplace-api.nextclaw.io/api/v1/skills/items/agent-browser/files"
    ]);
  });

  it("falls back per file when a domestic blob download times out", async () => {
    const workspace = createTempWorkspace();
    const requestedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        requestedUrls.push(url);
        if (url.endsWith("/api/v1/skills/items/agent-browser")) {
          return new Response(JSON.stringify({
            ok: true,
            data: {
              slug: "agent-browser",
              install: { kind: "marketplace" }
            }
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (url.endsWith("/api/v1/skills/items/agent-browser/files")) {
          return new Response(JSON.stringify({
            ok: true,
            data: {
              files: [{
                path: "SKILL.md",
                downloadPath: "/api/v1/skills/items/agent-browser/files/blob?path=SKILL.md"
              }]
            }
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (url.startsWith("https://api.nextclaw.net/") && url.includes("/files/blob")) {
          throw new DOMException("domestic blob timed out", "TimeoutError");
        }
        if (url.startsWith("https://marketplace-api.nextclaw.io/") && url.includes("/files/blob")) {
          return new Response("# agent-browser\n", { status: 200 });
        }
        return new Response(null, { status: 404 });
      })
    );

    await installMarketplaceSkill({
      slug: "agent-browser",
      workdir: workspace,
    });

    expect(readFileSync(join(workspace, "skills", "agent-browser", "SKILL.md"), "utf8")).toBe("# agent-browser\n");
    expect(requestedUrls).toContain("https://api.nextclaw.net/api/v1/skills/items/agent-browser/files/blob?path=SKILL.md");
    expect(requestedUrls).toContain("https://marketplace-api.nextclaw.io/api/v1/skills/items/agent-browser/files/blob?path=SKILL.md");
  });

  it("preserves a recoverable destination when every blob source fails", async () => {
    const workspace = createTempWorkspace();
    const destinationDir = join(workspace, "skills", "agent-browser");
    mkdirSync(destinationDir, { recursive: true });
    writeFileSync(join(destinationDir, "SKILL.md"), "# partial local download\n");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith("/api/v1/skills/items/agent-browser")) {
          return new Response(JSON.stringify({
            ok: true,
            data: {
              slug: "agent-browser",
              install: { kind: "marketplace" }
            }
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (url.endsWith("/api/v1/skills/items/agent-browser/files")) {
          return new Response(JSON.stringify({
            ok: true,
            data: {
              files: [
                { path: "SKILL.md", contentBase64: Buffer.from("# complete\n").toString("base64") },
                {
                  path: "scripts/run.mjs",
                  downloadPath: "/api/v1/skills/items/agent-browser/files/blob?path=scripts%2Frun.mjs"
                }
              ]
            }
          }), { status: 200, headers: { "content-type": "application/json" } });
        }
        if (url.includes("/files/blob")) {
          throw new DOMException("blob timed out", "TimeoutError");
        }
        return new Response(null, { status: 404 });
      })
    );

    await expect(() => installMarketplaceSkill({
      slug: "agent-browser",
      workdir: workspace,
    })).rejects.toThrow("blob timed out");

    expect(readFileSync(join(destinationDir, "SKILL.md"), "utf8")).toBe("# partial local download\n");
    expect(existsSync(join(destinationDir, "scripts", "run.mjs"))).toBe(false);
    expect(readdirSync(join(workspace, "skills")).filter((entry) => entry.startsWith(".agent-browser-install-"))).toEqual([]);
  });
});
