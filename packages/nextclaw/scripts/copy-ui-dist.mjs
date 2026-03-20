import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const pkgRoot = resolve(scriptDir, "..");
const source = resolve(pkgRoot, "..", "nextclaw-ui", "dist");
const target = resolve(pkgRoot, "ui-dist");

function assertUiDistReady(dir, label) {
  const indexPath = join(dir, "index.html");
  const assetsDir = join(dir, "assets");
  const assetEntries = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
  if (!existsSync(indexPath) || assetEntries.length === 0) {
    throw new Error(
      `${label} is incomplete at ${dir}. Build @nextclaw/ui before packaging nextclaw so ui-dist contains index.html and assets/.`
    );
  }
}

rmSync(target, { recursive: true, force: true });

if (!existsSync(source)) {
  throw new Error(`UI dist not found at ${source}. Build @nextclaw/ui before packaging nextclaw.`);
}

assertUiDistReady(source, "Source UI dist");
cpSync(source, target, { recursive: true });
assertUiDistReady(target, "Copied UI dist");
console.log(`✓ UI dist copied to ${target}`);
