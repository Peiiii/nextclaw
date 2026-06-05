import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAigenApp } from "../src/app/aigen-app.js";

describe("AigenApp", () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), "aigen-cli-home-"));
  });

  afterEach(async () => {
    await rm(homeDir, { recursive: true, force: true });
  });

  it("uses the commander command tree for provider commands", async () => {
    const app = createAigenApp(homeDir);
    const added = await app.run(["providers", "add", "openrouter", "--api-format", "openrouter", "--json"]);
    const listed = await app.run(["providers", "list", "--json"]);

    expect(added.ok).toBe(true);
    expect(listed.ok).toBe(true);
    expect(listed).toMatchObject({
      providers: [
        {
          id: "openrouter",
          apiFormat: "openrouter",
          apiBase: "https://openrouter.ai/api/v1"
        }
      ]
    });
  });

  it("returns commander argument errors as stable JSON failures", async () => {
    const app = createAigenApp(homeDir);
    const output = await app.run(["image", "--n", "not-a-number"]);

    expect(output).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_ARGUMENT"
      }
    });
    expect(output.ok ? "" : output.error.message).toContain("must be a number");
  });

  it("reports the package version", async () => {
    const app = createAigenApp(homeDir);
    const output = await app.run(["--version"]);

    expect(output).toEqual({
      ok: true,
      output: "0.1.0"
    });
  });
});
