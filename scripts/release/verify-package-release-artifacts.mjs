import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const packageDir = process.cwd();
const packageJsonPath = join(packageDir, "package.json");

if (!existsSync(packageJsonPath)) throw new Error(`package.json not found in ${packageDir}`);

const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));

const assertPath = (relativePath) => {
  const absolutePath = join(packageDir, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`${pkg.name}: missing ${relativePath} at ${absolutePath}. Run the release build first.`);
  }
  return absolutePath;
};

const assertDirectoryHasEntries = (relativePath) => {
  const absolutePath = assertPath(relativePath);
  if (readdirSync(absolutePath).length === 0) throw new Error(`${pkg.name}: ${relativePath} is empty at ${absolutePath}. Run the release build first.`);
};

const assertNextclawUiArtifacts = () => {
  assertPath("dist/index.html");
  assertDirectoryHasEntries("dist/assets");
};

const assertNextclawArtifacts = () => {
  ["dist/index.js", "dist/cli/app/index.js", "dist/cli/launcher/index.js", "dist/index.d.ts", "dist/cli/app/index.d.ts", "dist/cli/launcher/index.d.ts", "resources/update-bundle-public.pem"].forEach(assertPath);
  const sourceUiIndexPath = resolve(packageDir, "..", "nextclaw-ui", "dist", "index.html");
  if (readFileSync(sourceUiIndexPath, "utf8") !== readFileSync(assertPath("ui-dist/index.html"), "utf8")) {
    throw new Error(`${pkg.name}: ui-dist is stale. Run \`pnpm -C packages/nextclaw-ui build && pnpm -C packages/nextclaw build\` before publishing.`);
  }
  assertDirectoryHasEntries("ui-dist/assets");
};

switch (pkg.name) {
  case "@nextclaw/ui":
    assertNextclawUiArtifacts();
    break;
  case "nextclaw":
    assertNextclawArtifacts();
    break;
  default:
    throw new Error(`verify-package-release-artifacts does not support ${pkg.name} yet. Add an explicit verifier before using it in prepack.`);
}

console.log(`[verify-release-artifacts] ${pkg.name} artifacts are ready in ${resolve(packageDir)}`);
