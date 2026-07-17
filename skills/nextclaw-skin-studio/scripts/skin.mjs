import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { extname, join, resolve } from "node:path";

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
const presets = JSON.parse(readFileSync(new URL("../assets/skins.json", import.meta.url), "utf8"));
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

function readColor(flag, fallback) {
  const value = readFlag(flag) ?? fallback;
  if (!COLOR_PATTERN.test(value)) {
    fail(`${flag} must be a six-digit hex color such as #22d3ee`);
  }
  return value.toLowerCase();
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
  const base = findPreset(readFlag("--base") ?? "glass-tide");
  const idPart = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "skin";
  return {
    ...base,
    id: `custom-${idPart}`,
    name,
    description: `Custom skin based on ${base.name}`,
    accent: readColor("--accent", base.accent),
    secondary: readColor("--secondary", base.secondary),
    background: readColor("--background", base.background),
    panel: readColor("--panel", base.panel),
    text: readColor("--text", base.text),
    image: readImageDataUrl(),
  };
}

function renderSkin(config) {
  return [
    `// nextclaw-ui-skin-owner: ${OWNER}`,
    `// nextclaw-ui-skin-id: ${config.id}`,
    "// nextclaw-ui-skin-version: 1",
    `globalThis.__NEXTCLAW_SKIN_CONFIG__ = Object.freeze(${JSON.stringify(config)});`,
    renderer,
  ].join("\n");
}

function applySkin(config, home, targetPath) {
  const current = inspect(targetPath);
  if (current.state === "occupied") {
    fail(`Refusing to overwrite UI injection owned by ${current.owner ?? "another tool or an unknown source"}.`, 2);
  }
  const source = renderSkin(config);
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

if (action === "list") {
  const catalog = presets.map(({ id, name, description, mode }) => ({ id, name, description, mode }));
  if (args.includes("--json")) {
    process.stdout.write(`${JSON.stringify(catalog, null, 2)}\n`);
  } else {
    process.stdout.write(`${catalog.map((skin) => `${skin.id.padEnd(20)} ${skin.name} — ${skin.description}`).join("\n")}\n`);
  }
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
    applySkin(findPreset(id), home, targetPath);
  } else if (action === "custom" || action === "customize") {
    applySkin(createCustomSkin(), home, targetPath);
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
    fail("Usage: node scripts/skin.mjs <list|status|apply <skin-id>|custom|remove> [options]");
  }
}
