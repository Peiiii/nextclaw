#!/usr/bin/env node

const [nodeMajor = 0, nodeMinor = 0] = process.versions.node
  .split(".")
  .slice(0, 2)
  .map((part) => Number.parseInt(part, 10));
const nodeSupported = nodeMajor >= 24
  || (nodeMajor === 22 && nodeMinor >= 12)
  || (nodeMajor === 20 && nodeMinor >= 19);

if (!nodeSupported) {
  process.stderr.write(
    `NextClaw requires Node.js 20.19+, 22.12+, or 24+. Current version: ${process.versions.node}.\n` +
    "Install a supported Node.js version and run nextclaw again. No Python, compiler, or system SQLite is required.\n",
  );
  process.exitCode = 1;
} else {
  const [{ NextclawDistributionService, runNextclawNpmRuntimeLauncher }, { createNextclawDistribution }] =
    await Promise.all([
      import("@nextclaw/service"),
      import("@nextclaw-cli/cli/shared/lib/distribution/index.js"),
    ]);
  NextclawDistributionService.configure(createNextclawDistribution(import.meta.url));
  await runNextclawNpmRuntimeLauncher(process.argv);
}
