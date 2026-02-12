import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const pkgRoot = resolve(scriptDir, "..");
const source = resolve(pkgRoot, "..", "nextclaw-ui", "dist");
const target = resolve(pkgRoot, "ui-dist");

if (!existsSync(source)) {
  console.log("UI dist not found, skip copying.");
  process.exit(0);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log(`✓ UI dist copied to ${target}`);
