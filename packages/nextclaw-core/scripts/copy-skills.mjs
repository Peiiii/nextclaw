import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src", "agent", "skills");
const dest = join(root, "dist", "skills");

if (!existsSync(src)) {
  console.warn("[copy-skills] source directory missing:", src);
  process.exit(0);
}

mkdirSync(join(root, "dist"), { recursive: true });
cpSync(src, dest, { recursive: true, force: true });
console.log("[copy-skills] copied", src, "->", dest);
