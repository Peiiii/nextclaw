import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { createSkinProject, readSkinProject } from "./skin-project.mjs";

const OWNER = "nextclaw-skin-studio";
const LEGACY_MARKER = "// nextclaw-ui-theme-id: abyssal-compass-theme";
const OWNER_PATTERN = /^\/\/ nextclaw-ui-skin-owner: ([a-z0-9-]+)$/m;
const SKIN_PATTERN = /^\/\/ nextclaw-ui-skin-id: ([a-z0-9-]+)$/m;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const imageMimeByExtension = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
]);
const catalog = JSON.parse(readFileSync(new URL("../assets/skins.json", import.meta.url), "utf8"));
const presets = catalog.skins;
const styleAssets = [
  "foundation-styles.js",
  "navigation-styles.js",
  "content-styles.js",
  "control-styles.js",
].map((fileName) => readFileSync(new URL(`../assets/${fileName}`, import.meta.url), "utf8"));
const renderer = readFileSync(new URL("../assets/renderer.js", import.meta.url), "utf8");
const args = process.argv.slice(2);
const action = args[0] ?? "status";

function readFlag(name) {
  const index = args.indexOf(name);
  if (index < 0) {
    return undefined;
  }
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    fail(`${name} requires a value`);
  }
  return value.trim();
}

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function resolveHome() {
  return resolve(readFlag("--home") || process.env.NEXTCLAW_HOME?.trim() || join(homedir(), ".nextclaw"));
}

function inspect(targetPath) {
  if (!existsSync(targetPath)) {
    return { state: "inactive", owner: null, skinId: null };
  }
  const source = readFileSync(targetPath, "utf8");
  const owner = source.match(OWNER_PATTERN)?.[1] ?? null;
  const skinId = source.match(SKIN_PATTERN)?.[1] ?? null;
  if (owner === OWNER) {
    return { state: "active", owner, skinId };
  }
  if (source.startsWith(LEGACY_MARKER)) {
    return { state: "legacy", owner: "abyssal-compass-theme", skinId: "abyssal-compass" };
  }
  return { state: "occupied", owner, skinId };
}

function report(home, targetPath, result) {
  process.stdout.write(`${JSON.stringify({ home, targetPath, ...result }, null, 2)}\n`);
}

function findPreset(id) {
  const preset = presets.find((entry) => entry.id === id);
  if (!preset) {
    fail(`Unknown skin: ${id}. Run 'node scripts/skin.mjs list' to see available skins.`);
  }
  return preset;
}

function resolveSourceUrl(preset) {
  return new URL(preset.asset.path, catalog.source.rawBaseUrl).href;
}

function verifyImage(buffer, preset, sourceLabel) {
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    fail(`Skin asset is larger than 5 MB: ${sourceLabel}`);
  }
  const digest = createHash("sha256").update(buffer).digest("hex");
  if (digest !== preset.asset.sha256) {
    fail(`Skin asset integrity check failed for ${preset.id}: expected ${preset.asset.sha256}, received ${digest}`);
  }
  return `data:${preset.asset.contentType};base64,${buffer.toString("base64")}`;
}

async function readPresetImage(preset) {
  const sourceDirectory = readFlag("--source-dir");
  if (sourceDirectory) {
    const root = resolve(sourceDirectory);
    const sourcePath = resolve(root, preset.asset.path);
    if (sourcePath !== root && !sourcePath.startsWith(`${root}${sep}`)) {
      fail(`Skin asset path escapes --source-dir: ${preset.asset.path}`);
    }
    if (!existsSync(sourcePath)) {
      fail(`Skin asset is missing from --source-dir: ${sourcePath}`);
    }
    return {
      image: verifyImage(readFileSync(sourcePath), preset, sourcePath),
      assetSource: sourcePath,
    };
  }

  const sourceUrl = resolveSourceUrl(preset);
  let response;
  try {
    response = await fetch(sourceUrl, { signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    fail(`Unable to download ${preset.name} from the pinned upstream source: ${error.message}`);
  }
  if (!response.ok) {
    fail(`Unable to download ${preset.name} from the pinned upstream source: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    image: verifyImage(buffer, preset, sourceUrl),
    assetSource: sourceUrl,
  };
}

function readColor(flag, fallback) {
  const value = readFlag(flag) ?? fallback;
  if (!COLOR_PATTERN.test(value)) {
    fail(`${flag} must be a six-digit hex color such as #22d3ee`);
  }
  return value.toLowerCase();
}

function toSkinId(name) {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "custom-skin";
}

function readImageDataUrl() {
  const imagePath = readFlag("--image");
  if (!imagePath) {
    return undefined;
  }
  const absolutePath = resolve(imagePath);
  const mime = imageMimeByExtension.get(extname(absolutePath).toLowerCase());
  if (!mime) {
    fail("--image supports PNG, JPEG, and WebP files only");
  }
  const size = statSync(absolutePath).size;
  if (size > MAX_IMAGE_BYTES) {
    fail("--image must be 5 MB or smaller");
  }
  return `data:${mime};base64,${readFileSync(absolutePath).toString("base64")}`;
}

function createCustomSkin() {
  const name = readFlag("--name");
  if (!name || name.length > 60) {
    fail("custom requires --name with 1 to 60 characters");
  }
  const base = findPreset(readFlag("--base") ?? "gothic-void-crusade");
  return {
    ...base,
    id: `custom-${toSkinId(name)}`,
    name,
    description: `Custom skin based on ${base.name}`,
    accent: readColor("--accent", base.accent),
    secondary: readColor("--secondary", base.secondary),
    background: readColor("--background", base.background),
    panel: readColor("--panel", base.panel),
    text: readColor("--text", base.text),
  };
}

function readProjectDirectory() {
  const value = args[1];
  if (!value || value.startsWith("--")) {
    fail(`${action} requires an absolute or relative skin project directory`);
  }
  return resolve(value);
}

function createProject(projectDirectory) {
  const name = readFlag("--name");
  if (!name || name.length > 60) fail("create-project requires --name with 1 to 60 characters");
  const id = readFlag("--id") ?? toSkinId(name);
  const base = findPreset(readFlag("--base") ?? "gothic-void-crusade");
  try {
    process.stdout.write(`${JSON.stringify(createSkinProject({ projectDirectory, id, name, base }), null, 2)}\n`);
  } catch (error) {
    fail(error.message);
  }
}

async function prepareProject(projectDirectory) {
  let source;
  try {
    source = readSkinProject(projectDirectory);
  } catch (error) {
    fail(error.message);
  }
  const base = findPreset(source.project.base);
  const resolvedAsset = source.image
    ? { image: source.image, assetSource: "project-image" }
    : await readPresetImage(base);
  return {
    config: {
      ...base,
      ...source.tokens,
      id: source.project.id,
      name: source.project.name,
      description: source.project.description ?? `Personal NextClaw skin based on ${base.name}`,
      art: { ...base.art, ...source.art },
      details: { ...base.details, ...source.details },
      asset: { ...base.asset, kind: source.project.assetKind },
      ...resolvedAsset,
    },
    projectSource: { css: source.css, javaScript: source.javaScript },
  };
}

async function prepareSkin(config) {
  const localImage = readImageDataUrl();
  if (localImage) {
    return { ...config, image: localImage, assetSource: "local-image" };
  }
  const resolvedAsset = await readPresetImage(config);
  return { ...config, ...resolvedAsset };
}

function renderSkin(config, projectSource = { css: "", javaScript: "" }) {
  return [
    `// nextclaw-ui-skin-owner: ${OWNER}`,
    `// nextclaw-ui-skin-id: ${config.id}`,
    "// nextclaw-ui-skin-version: 3",
    `globalThis.__NEXTCLAW_SKIN_CONFIG__ = Object.freeze(${JSON.stringify(config)});`,
    `globalThis.__NEXTCLAW_SKIN_PROJECT_CSS__ = ${JSON.stringify(projectSource.css)};`,
    ...styleAssets,
    renderer,
    projectSource.javaScript,
  ].join("\n");
}

function applySkin(config, home, targetPath, projectSource) {
  const source = renderSkin(config, projectSource);
  const changed = !existsSync(targetPath) || readFileSync(targetPath, "utf8") !== source;
  if (changed) {
    mkdirSync(home, { recursive: true });
    const temporaryPath = `${targetPath}.tmp-${process.pid}`;
    writeFileSync(temporaryPath, source, "utf8");
    renameSync(temporaryPath, targetPath);
  }
  report(home, targetPath, {
    state: "active",
    owner: OWNER,
    skinId: config.id,
    skinName: config.name,
    changed,
    refreshRequired: changed,
  });
}

function assertWritable(targetPath) {
  const current = inspect(targetPath);
  if (current.state === "occupied") {
    fail(`Refusing to overwrite UI injection owned by ${current.owner ?? "another tool or an unknown source"}.`, 2);
  }
}

if (action === "list") {
  const list = presets.map(({ id, name, description, mode, upstreamLabel, asset }) => ({
    id,
    name,
    description,
    mode,
    upstreamLabel,
    assetKind: asset.kind,
    previewUrl: resolveSourceUrl({ asset }),
  }));
  if (args.includes("--json")) {
    process.stdout.write(`${JSON.stringify(list, null, 2)}\n`);
  } else {
    process.stdout.write(`${list.map((skin) => `${skin.id.padEnd(22)} ${skin.name} — ${skin.description}`).join("\n")}\n`);
  }
} else if (action === "create-project") {
  createProject(readProjectDirectory());
} else {
  const home = resolveHome();
  const targetPath = join(home, "ui-inject.js");
  const current = inspect(targetPath);
  if (action === "status") {
    report(home, targetPath, { ...current, changed: false, refreshRequired: false });
  } else if (action === "apply") {
    const id = args[1];
    if (!id || id.startsWith("--")) {
      fail("apply requires a skin id. Run 'node scripts/skin.mjs list' first.");
    }
    assertWritable(targetPath);
    applySkin(await prepareSkin(findPreset(id)), home, targetPath);
  } else if (action === "custom" || action === "customize") {
    assertWritable(targetPath);
    applySkin(await prepareSkin(createCustomSkin()), home, targetPath);
  } else if (action === "apply-project") {
    assertWritable(targetPath);
    const { config, projectSource } = await prepareProject(readProjectDirectory());
    applySkin(config, home, targetPath, projectSource);
  } else if (action === "remove") {
    if (current.state === "occupied") {
      fail(`Refusing to remove UI injection owned by ${current.owner ?? "another tool or an unknown source"}.`, 2);
    }
    const changed = current.state === "active" || current.state === "legacy";
    if (changed) {
      unlinkSync(targetPath);
    }
    report(home, targetPath, {
      state: "inactive",
      owner: null,
      skinId: null,
      changed,
      refreshRequired: changed,
    });
  } else {
    fail("Usage: node scripts/skin.mjs <list|status|apply <skin-id>|custom|create-project <directory>|apply-project <directory>|remove> [options]");
  }
}
