import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const changesetDir = join(process.cwd(), ".changeset");
const packages = ["@nextclaw/ui", "nextclaw"];

const findExistingChangeset = () => {
  if (!existsSync(changesetDir)) {
    return null;
  }
  const entries = readdirSync(changesetDir);
  for (const entry of entries) {
    if (!entry.endsWith(".md")) {
      continue;
    }
    const fullPath = join(changesetDir, entry);
    const content = readFileSync(fullPath, "utf8");
    if (packages.every((name) => content.includes(`\"${name}\"`))) {
      return entry;
    }
  }
  return null;
};

const ensureChangeset = () => {
  const existing = findExistingChangeset();
  if (existing) {
    console.log(`[release:frontend] Reuse existing changeset: ${existing}`);
    return;
  }
  if (!existsSync(changesetDir)) {
    mkdirSync(changesetDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const filename = `frontend-ui-release-${timestamp}.md`;
  const filePath = join(changesetDir, filename);
  const body = `---\n\"@nextclaw/ui\": patch\n\"nextclaw\": patch\n---\n\nRelease frontend UI changes only.\n`;
  writeFileSync(filePath, body, "utf8");
  console.log(`[release:frontend] Created changeset: ${filename}`);
};

ensureChangeset();
