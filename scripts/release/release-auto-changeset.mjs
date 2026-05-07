import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  collectWorkspacePackages,
  readMeaningfulPublishDrift,
  readPendingChangesetPackages
} from "./release-scope.mjs";

const changesetDir = join(process.cwd(), ".changeset");
const isCheckMode = process.argv.includes("--check");

const pendingChangesetPackages = readPendingChangesetPackages();
const releaseEntries = collectWorkspacePackages()
  .filter((entry) => entry.private === false)
  .map((entry) => ({
    entry,
    driftFiles: readMeaningfulPublishDrift(entry)
  }))
  .filter(({ entry }) => !pendingChangesetPackages.has(entry.pkg.name))
  .sort((left, right) => left.entry.pkg.name.localeCompare(right.entry.pkg.name));

if (releaseEntries.length === 0) {
  if (pendingChangesetPackages.size > 0) {
    console.log(
      `[release:auto:changeset] no additional public packages. existing pending changesets cover: ${Array.from(
        pendingChangesetPackages
      )
        .sort((left, right) => left.localeCompare(right))
        .join(", ")}`
    );
    process.exit(0);
  }

  console.error(
    "[release:auto:changeset] no public workspace packages found."
  );
  process.exit(1);
}

console.log(
  `[release:auto:changeset] selected public packages: ${releaseEntries
    .map(({ entry }) => entry.pkg.name)
    .join(", ")}`
);
for (const { entry, driftFiles } of releaseEntries) {
  console.log(`- ${entry.pkg.name}@${entry.pkg.version}`);
  for (const driftFile of driftFiles) {
    console.log(`  - ${driftFile}`);
  }
}

if (isCheckMode) {
  console.log("[release:auto:changeset] check mode only. no changeset written.");
  process.exit(0);
}

if (!existsSync(changesetDir)) {
  mkdirSync(changesetDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
const fileName = `auto-release-batch-${timestamp}.md`;
const filePath = join(changesetDir, fileName);
const header = releaseEntries
  .map(({ entry }) => `"${entry.pkg.name}": patch`)
  .join("\n");
const packageList = releaseEntries.map(({ entry }) => `- ${entry.pkg.name}`).join("\n");
const summary = "Auto-generated full public beta release batch.";
const body = `---\n${header}\n---\n\n${summary}\n\nPackages:\n${packageList}\n`;

writeFileSync(filePath, body, "utf8");
console.log(`[release:auto:changeset] created changeset: ${fileName}`);
