import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { readJson } from "./topology-governance-shared.mjs";

test("readJson preserves comment markers inside JSONC strings", (context) => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "nextclaw-topology-jsonc-"));
  const fixturePath = path.join(fixtureDir, "tsconfig.json");
  context.after(() => rmSync(fixtureDir, { force: true, recursive: true }));

  writeFileSync(
    fixturePath,
    `{
      /* Bundler mode */
      "compilerOptions": {
        "paths": {
          "@/*": ["src/*"],
          "url": ["https://nextclaw.dev/*"],
        },
      },
    }`
  );

  assert.deepEqual(readJson(fixturePath), {
    compilerOptions: {
      paths: {
        "@/*": ["src/*"],
        url: ["https://nextclaw.dev/*"]
      }
    }
  });
});
