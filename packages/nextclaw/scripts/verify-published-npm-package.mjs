import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export async function verifyPublishedNpmPackageArchive(options) {
  const { expectedVersion, run } = options;
  const tempRoot = await mkdtemp(
    join(
      tmpdir(),
      `nextclaw-published-stable-package-${expectedVersion}-smoke-`,
    ),
  );
  try {
    const packResult = run(
      "npm",
      [
        "pack",
        `nextclaw@${expectedVersion}`,
        "--pack-destination",
        tempRoot,
        "--ignore-scripts",
        "--json",
        "--cache",
        join(tempRoot, "npm-cache"),
        "--prefer-online",
      ],
      { cwd: tempRoot, timeout: 120000 },
    );
    const parsed = JSON.parse(packResult.stdout.trim());
    const entry = Array.isArray(parsed) ? parsed[0] : parsed;
    assert(
      typeof entry?.filename === "string",
      "npm pack did not return a tarball filename",
    );
    const tarballPath = resolve(tempRoot, entry.filename);
    run("tar", ["-xzf", tarballPath, "-C", tempRoot], { cwd: tempRoot });
    const packageDirectory = join(tempRoot, "package");
    const packageJson = JSON.parse(
      readFileSync(join(packageDirectory, "package.json"), "utf8"),
    );
    assert(
      packageJson.version === expectedVersion,
      `expected nextclaw ${expectedVersion}, got ${packageJson.version}`,
    );
    for (const relativePath of [
      "dist/cli/app/index.js",
      "dist/cli/launcher/index.js",
      "resources/update-bundle-public.pem",
      "ui-dist/index.html",
    ]) {
      assert(
        existsSync(join(packageDirectory, relativePath)),
        `published nextclaw is missing ${relativePath}`,
      );
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}
