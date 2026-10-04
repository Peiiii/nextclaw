import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, copyFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputFlag = process.argv.indexOf("--output");
if (outputFlag < 0 || !process.argv[outputFlag + 1]) throw new Error("Usage: node scripts/bibo/export-bibo.controller.mjs --output <empty-directory>");
const output = resolve(process.argv[outputFlag + 1]);
await mkdir(output, { recursive: true });
if ((await readdir(output)).length) throw new Error("Export requires an empty directory; existing repositories are never overwritten.");
const git = (...args) => execFileSync("git", args, { cwd: source, encoding: "utf8" }).trim();
const files = git("ls-files", "--cached", "--others", "--exclude-standard").split("\n");
const roots = ["apps/bibo-hosted/", "packages/bibo-client/", "packages/personal-agent-ui/"];
const selected = files.filter((file) => roots.some((root) => file.startsWith(root)) &&
  !/(?:^|\/)(?:AGENTS\.md|CLAUDE\.md|README\.md|CHANGELOG\.md|module-structure\.config\.json)$/.test(file) &&
  !file.startsWith("apps/bibo-hosted/scripts/diagnostics/") && !file.startsWith("apps/bibo-hosted/scripts/deployment/") &&
  /\.(?:ts|tsx|css|json|html|svg)$/.test(file));
const screenshots = ["bibo-sandbox-workspace", "bibo-chat-report", "bibo-sandbox-analysis", "bibo-tasks"]
  .map((name) => `images/screenshots/${name}.png`);
for (const file of selected.concat("LICENSE", ".nvmrc", "tsconfig.base.json", screenshots)) {
  const target = resolve(output, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(source, file), target);
}
const manifests = git("ls-files", "packages/**/package.json").split("\n");
const catalog = new Map(await Promise.all(manifests.map(async (file) => {
  const value = JSON.parse(await readFile(resolve(source, file), "utf8"));
  return [value.name, value];
})));
const local = new Set(["@nextclaw/bibo-client", "@nextclaw/personal-agent-ui"]);
const versions = new Map();
function pinPublicPackage(name) {
  if (versions.has(name)) return;
  const manifest = catalog.get(name);
  if (!manifest || manifest.private) throw new Error(`Dependency is not a public package: ${name}`);
  versions.set(name, manifest.version);
  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    if (catalog.has(dependency)) pinPublicPackage(dependency);
  }
}
function replaceWorkspaceVersions(manifest) {
  const result = structuredClone(manifest);
  for (const field of ["dependencies", "devDependencies"]) {
    for (const [name, version] of Object.entries(result[field] ?? {})) {
      if (!String(version).startsWith("workspace:") || local.has(name)) continue;
      pinPublicPackage(name);
      result[field][name] = versions.get(name);
    }
  }
  return result;
}
for (const directory of roots) {
  const target = resolve(output, directory, "package.json");
  const manifest = replaceWorkspaceVersions(JSON.parse(await readFile(target, "utf8")));
  if (directory.startsWith("apps/")) {
    const scripts = manifest.scripts;
    manifest.scripts = { tsc: scripts.tsc, test: scripts.test, "test:self-hosted": scripts["test:self-hosted"],
      build: "vite build --mode self-hosted", dev: "vite --mode ui --host 127.0.0.1 --port 5188 --strictPort",
      "dev:worker": "wrangler dev", "dev:proxy": "vite --mode self-hosted --host 127.0.0.1 --port 5188 --strictPort",
      deploy: "wrangler deploy" };
    manifest.devDependencies.wrangler = "4.138.0";
    manifest.devDependencies["@cloudflare/workers-types"] = "5.20260921.1";
  }
  await writeFile(target, JSON.stringify(manifest, null, 2) + "\n");
}
await copyFile(resolve(source, "apps/bibo-hosted/wrangler.self-hosted.toml"), resolve(output, "apps/bibo-hosted/wrangler.toml"));
await copyFile(resolve(source, "scripts/bibo/open-source/help.html"), resolve(output, "apps/bibo-hosted/static/help.html"));
const root = { name: "bibo", version: "0.1.0", private: true, type: "module", license: "MIT", packageManager: "pnpm@9.15.1",
  engines: { node: ">=22.23.2" }, scripts: {
    dev: "pnpm -C apps/bibo-hosted dev", build: "pnpm -C apps/bibo-hosted build",
    typecheck: "pnpm -r tsc", test: "pnpm -C apps/bibo-hosted test && pnpm -C apps/bibo-hosted test:self-hosted",
    deploy: "pnpm build && pnpm -C apps/bibo-hosted deploy",
    "dev:worker": "pnpm -C apps/bibo-hosted dev:worker", "dev:proxy": "pnpm -C apps/bibo-hosted dev:proxy",
  }, pnpm: { overrides: Object.fromEntries(versions) } };
await writeFile(resolve(output, "package.json"), JSON.stringify(root, null, 2) + "\n");
await writeFile(resolve(output, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n  - "packages/*"\n');
await writeFile(resolve(output, ".gitignore"), "node_modules/\ndist/\n.wrangler/\n.dev.vars*\n.env*\n*.log\n.DS_Store\n");
await writeFile(resolve(output, "SOURCE.json"), JSON.stringify({ repository: "https://github.com/Peiiii/nextclaw",
  commit: git("rev-parse", "HEAD"), dirty: Boolean(git("status", "--porcelain")), exporter: "scripts/bibo/export-bibo.controller.mjs" }, null, 2) + "\n");
for (const file of ["README.md", "README.zh-CN.md", "CONTRIBUTING.md", "SECURITY.md", "CHANGELOG.md"]) {
  await copyFile(resolve(source, "scripts/bibo/open-source", file), resolve(output, file));
}
await mkdir(resolve(output, ".github/workflows"), { recursive: true });
await writeFile(resolve(output, ".github/workflows/ci.yml"), `name: CI
on: [push, pull_request]
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
      - run: pnpm -C apps/bibo-hosted exec wrangler deploy --dry-run
`);
console.log(JSON.stringify({ output, sourceCommit: git("rev-parse", "HEAD"), sourceFiles: selected.length }));
