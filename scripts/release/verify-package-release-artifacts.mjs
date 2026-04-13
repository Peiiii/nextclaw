import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const packageDir = process.cwd();
const packageJsonPath = join(packageDir, "package.json");

if (!existsSync(packageJsonPath)) {
  throw new Error(`package.json not found in ${packageDir}`);
}

const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));

const assertPath = (relativePath, label) => {
  const absolutePath = join(packageDir, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`${pkg.name}: missing ${label} at ${absolutePath}. Run the release build first.`);
  }
  return absolutePath;
};

const assertDirectoryHasEntries = (relativePath, label) => {
  const absolutePath = assertPath(relativePath, label);
  const entries = readdirSync(absolutePath);
  if (entries.length === 0) {
    throw new Error(`${pkg.name}: ${label} is empty at ${absolutePath}. Run the release build first.`);
  }
};

const assertNextclawUiArtifacts = () => {
  assertPath("dist/index.html", "dist index.html");
  assertDirectoryHasEntries("dist/assets", "dist/assets");
};

const assertNextclawArtifacts = () => {
  assertPath("dist/index.js", "dist/index.js");
  assertPath("dist/cli/index.js", "dist/cli/index.js");
  assertPath("dist/index.d.ts", "dist/index.d.ts");
  assertPath("dist/cli/index.d.ts", "dist/cli/index.d.ts");
  assertPath("ui-dist/index.html", "ui-dist index.html");
  assertDirectoryHasEntries("ui-dist/assets", "ui-dist/assets");
};

switch (pkg.name) {
  case "@nextclaw/ui":
    assertNextclawUiArtifacts();
    break;
  case "nextclaw":
    assertNextclawArtifacts();
    break;
  default:
    throw new Error(
      `verify-package-release-artifacts does not support ${pkg.name} yet. Add an explicit verifier before using it in prepack.`
    );
}

console.log(`[verify-release-artifacts] ${pkg.name} artifacts are ready in ${resolve(packageDir)}`);
