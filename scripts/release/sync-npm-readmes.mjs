import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = process.cwd();
const mode = process.argv.includes("--check") ? "check" : "write";

const mappings = [
  {
    source: join(root, "docs/npm-readmes/nextclaw.md"),
    target: join(root, "packages/nextclaw/README.md"),
  },
  {
    source: join(root, "docs/npm-readmes/nextclaw-ui.md"),
    target: join(root, "packages/nextclaw-ui/README.md"),
  },
];

const normalize = (content) => content.replace(/\r\n/g, "\n").replace(/\s+$/g, "") + "\n";

let updates = 0;
let stale = 0;

for (const item of mappings) {
  const sourcePath = resolve(item.source);
  const targetPath = resolve(item.target);
  const source = normalize(readFileSync(sourcePath, "utf8"));
  let target = "";
  try {
    target = normalize(readFileSync(targetPath, "utf8"));
  } catch {
    target = "";
  }

  if (source === target) {
    console.log(`[sync-npm-readmes] up-to-date: ${item.target}`);
    continue;
  }

  if (mode === "check") {
    stale += 1;
    console.error(`[sync-npm-readmes] stale: ${item.target} (source: ${item.source})`);
    continue;
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, source, "utf8");
  updates += 1;
  console.log(`[sync-npm-readmes] updated: ${item.target}`);
}

if (mode === "check" && stale > 0) {
  process.exit(1);
}

if (mode === "write") {
  console.log(`[sync-npm-readmes] done. updated=${updates}`);
}
