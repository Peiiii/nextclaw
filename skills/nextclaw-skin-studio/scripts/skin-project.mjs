import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, join, resolve, sep } from "node:path";

const schemaVersion = 1;
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const colorPattern = /^#[0-9a-f]{6}$/i;
const maxImageBytes = 5 * 1024 * 1024;
const maxTextBytes = 5 * 1024 * 1024;
const tokenNames = new Set(["mode", "background", "panel", "text", "muted", "accent", "secondary", "border"]);
const artNames = new Set(["focusX", "focusY", "zoom"]);
const detailNames = new Set(["signature", "tagline", "label", "motif", "cardCaption", "sticker"]);
const imageMimeByExtension = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
]);

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value;
}

function assertKnownKeys(value, knownKeys, label) {
  const unknownKey = Object.keys(value).find((key) => !knownKeys.has(key));
  if (unknownKey) throw new Error(`${label} contains an unsupported field: ${unknownKey}`);
}

function readProjectText(projectDirectory, fileName, required = true) {
  const filePath = join(projectDirectory, fileName);
  if (!existsSync(filePath)) {
    if (required) throw new Error(`Skin project is missing ${fileName}: ${filePath}`);
    return "";
  }
  if (statSync(filePath).size > maxTextBytes) throw new Error(`${fileName} must be 5 MB or smaller`);
  return readFileSync(filePath, "utf8");
}

function parseProject(projectDirectory) {
  let project;
  try {
    project = JSON.parse(readProjectText(projectDirectory, "skin.json"));
  } catch (error) {
    throw new Error(`skin.json is not valid JSON: ${error.message}`);
  }
  assertPlainObject(project, "skin.json");
  assertKnownKeys(project, new Set([
    "schemaVersion", "id", "name", "description", "base", "tokens", "art", "details", "image", "assetKind",
  ]), "skin.json");
  if (project.schemaVersion !== schemaVersion) throw new Error(`skin.json schemaVersion must be ${schemaVersion}`);
  if (typeof project.id !== "string" || !idPattern.test(project.id) || project.id.length > 60) {
    throw new Error("skin.json id must be a kebab-case identifier up to 60 characters");
  }
  if (typeof project.name !== "string" || !project.name.trim() || project.name.length > 60) {
    throw new Error("skin.json name must contain 1 to 60 characters");
  }
  if (project.description !== undefined && (typeof project.description !== "string" || project.description.length > 240)) {
    throw new Error("skin.json description must be a string up to 240 characters");
  }
  if (typeof project.base !== "string" || !idPattern.test(project.base)) {
    throw new Error("skin.json base must be a bundled skin id");
  }
  if (project.image !== null && (typeof project.image !== "string" || !project.image.trim())) {
    throw new Error("skin.json image must be null or a relative project image path");
  }
  if (!new Set(["concept-preview", "preset-background"]).has(project.assetKind)) {
    throw new Error("skin.json assetKind must be concept-preview or preset-background");
  }
  return project;
}

function validateTokens(tokens) {
  assertPlainObject(tokens, "skin.json tokens");
  assertKnownKeys(tokens, tokenNames, "skin.json tokens");
  for (const [name, value] of Object.entries(tokens)) {
    if (name === "mode") {
      if (!new Set(["light", "dark"]).has(value)) throw new Error("skin.json tokens.mode must be light or dark");
    } else if (typeof value !== "string" || !colorPattern.test(value)) {
      throw new Error(`skin.json tokens.${name} must be a six-digit hex color`);
    }
  }
  return tokens;
}

function validateArt(art) {
  assertPlainObject(art, "skin.json art");
  assertKnownKeys(art, artNames, "skin.json art");
  for (const [name, value] of Object.entries(art)) {
    const valid = typeof value === "number" && Number.isFinite(value)
      && (name === "zoom" ? value >= 50 && value <= 600 : value >= 0 && value <= 1);
    if (!valid) throw new Error(`skin.json art.${name} is outside its supported numeric range`);
  }
  return art;
}

function validateDetails(details) {
  assertPlainObject(details, "skin.json details");
  assertKnownKeys(details, detailNames, "skin.json details");
  for (const [name, value] of Object.entries(details)) {
    const valid = name === "sticker"
      ? typeof value === "boolean"
      : typeof value === "string" && value.length <= 120;
    if (!valid) throw new Error(`skin.json details.${name} has an invalid value`);
  }
  return details;
}

function readProjectImage(projectDirectory, image) {
  if (image === null) return undefined;
  const imagePath = resolve(projectDirectory, image);
  if (imagePath === projectDirectory || !imagePath.startsWith(`${projectDirectory}${sep}`)) {
    throw new Error("skin.json image must stay inside the skin project directory");
  }
  if (!existsSync(imagePath)) throw new Error(`Skin project image does not exist: ${image}`);
  const mime = imageMimeByExtension.get(extname(imagePath).toLowerCase());
  if (!mime) throw new Error("Skin project image supports PNG, JPEG, and WebP files only");
  if (statSync(imagePath).size > maxImageBytes) throw new Error("Skin project image must be 5 MB or smaller");
  return `data:${mime};base64,${readFileSync(imagePath).toString("base64")}`;
}

export function createSkinProject({ projectDirectory, id, name, base }) {
  if (!idPattern.test(id) || id.length > 60) throw new Error("--id must be a kebab-case identifier up to 60 characters");
  if (existsSync(projectDirectory)) {
    if (!statSync(projectDirectory).isDirectory() || readdirSync(projectDirectory).length > 0) {
      throw new Error(`Refusing to overwrite non-empty skin project directory: ${projectDirectory}`);
    }
  }
  mkdirSync(projectDirectory, { recursive: true });
  const project = {
    schemaVersion,
    id,
    name,
    description: `Personal NextClaw skin based on ${base.name}`,
    base: base.id,
    tokens: {},
    art: {},
    details: {},
    image: null,
    assetKind: base.asset.kind,
  };
  const css = "/* Arbitrary CSS. Keep selectors under the skin root when practical. */\nhtml.nextclaw-skin-studio {\n  /* Add project tokens or global visual rules here. */\n}\n";
  const javaScript = "/* Arbitrary same-origin JavaScript. It has full page access and runs at your own risk.\n * Use standard browser APIs directly; Skin Studio does not provide or restrict a JavaScript API.\n */\n";
  writeFileSync(join(projectDirectory, "skin.json"), `${JSON.stringify(project, null, 2)}\n`, "utf8");
  writeFileSync(join(projectDirectory, "skin.css"), css, "utf8");
  writeFileSync(join(projectDirectory, "skin.js"), javaScript, "utf8");
  return { state: "created", projectDirectory, skinId: id, files: ["skin.json", "skin.css", "skin.js"] };
}

export function readSkinProject(projectDirectory) {
  const project = parseProject(projectDirectory);
  const css = readProjectText(projectDirectory, "skin.css");
  const javaScript = readProjectText(projectDirectory, "skin.js", false);
  try {
    Function(javaScript);
  } catch (error) {
    throw new Error(`skin.js contains invalid project JavaScript syntax: ${error.message}`);
  }
  return {
    project,
    tokens: validateTokens(project.tokens),
    art: validateArt(project.art),
    details: validateDetails(project.details),
    css,
    javaScript,
    image: readProjectImage(projectDirectory, project.image),
  };
}
