import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const referencePaths = {
  en: new URL("../../../../../apps/docs/en/guide/commands.md", import.meta.url),
  zh: new URL("../../../../../apps/docs/zh/guide/commands.md", import.meta.url),
};

function readDocumentedCommandPaths(referencePath: URL): string[] {
  const markdown = readFileSync(referencePath, "utf8");
  return Array.from(
    markdown.matchAll(/^\|\s*`(nextclaw(?: [a-z0-9-]+)+)`\s*\|/gm),
    ([, path]) => path,
  );
}

describe("NextClaw CLI command reference", () => {
  const packageRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const registeredCommands = JSON.parse(
    execFileSync(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      [
        "exec",
        "tsx",
        "--tsconfig",
        "../../scripts/dev/dev-runtime.tsconfig.json",
        "scripts/print-cli-command-catalog.mjs",
      ],
      { cwd: packageRoot, encoding: "utf8" },
    ),
  ) as string[];

  for (const [locale, referencePath] of Object.entries(referencePaths)) {
    it(`${locale} documents every registered leaf command exactly once`, () => {
      const documentedCommands = readDocumentedCommandPaths(referencePath);

      expect(new Set(documentedCommands).size).toBe(documentedCommands.length);
      expect(documentedCommands.sort()).toEqual(registeredCommands);
    });
  }
});
