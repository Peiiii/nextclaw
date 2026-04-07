import { execFileSync } from "node:child_process";
import {
  collectWorkspacePackages,
  getPackageTagName,
  hasGitTag,
  isPackageVersionPublished,
  readMeaningfulVersionDrift
} from "./release-scope.mjs";

const shouldWrite = process.argv.includes("--write");

const candidates = collectWorkspacePackages()
  .filter((entry) => entry.private === false)
  .filter((entry) => !hasGitTag(getPackageTagName(entry.pkg)))
  .filter((entry) => isPackageVersionPublished(entry))
  .filter((entry) => readMeaningfulVersionDrift(entry).length === 0)
  .sort((left, right) => left.pkg.name.localeCompare(right.pkg.name));

if (candidates.length === 0) {
  console.log("[release:sync:published-tags] no published-tag drift found.");
  process.exit(0);
}

console.log(
  `[release:sync:published-tags] candidates: ${candidates.map((entry) => entry.pkg.name).join(", ")}`
);

if (!shouldWrite) {
  console.log("[release:sync:published-tags] dry-run only. Re-run with --write to create tags.");
  process.exit(0);
}

for (const entry of candidates) {
  const tagName = getPackageTagName(entry.pkg);
  execFileSync("git", ["tag", tagName], {
    cwd: process.cwd(),
    stdio: "ignore"
  });
  console.log(`[release:sync:published-tags] created tag: ${tagName}`);
}

console.log(`[release:sync:published-tags] done. created=${candidates.length}`);
