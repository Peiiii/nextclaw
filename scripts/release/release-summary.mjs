import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CHANGESET_HEADER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const IMAGE_DIRECTIVE_PREFIX = "<!-- release-note-image:";
const IMAGE_DIRECTIVE_PATTERN =
  /^<!-- release-note-image:\s*(zh-CN|en-US)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*-->$/;
const RELEASE_IMAGE_ROOT = "images/screenshots";
const RELEASE_IMAGE_EXTENSIONS = new Set([".jpeg", ".jpg", ".png", ".webp"]);

function readAppliedChangesets(changesetDir) {
  const preStatePath = join(changesetDir, "pre.json");
  if (!existsSync(preStatePath)) {
    return new Set();
  }
  const preState = JSON.parse(readFileSync(preStatePath, "utf8"));
  return new Set(preState.changesets ?? []);
}

function parsePackages(header) {
  return header
    .split(/\r?\n/)
    .map((line) => line.trim().match(/^["']?([^"']+)["']?\s*:\s*(major|minor|patch)\s*$/))
    .filter(Boolean)
    .map((match) => ({ name: match[1], bump: match[2] }));
}

function validateImage(rootDir, changesetFile, locale, sourcePath, alt) {
  const normalizedPath = sourcePath.replaceAll("\\", "/");
  const imageRoot = resolve(rootDir, RELEASE_IMAGE_ROOT);
  const absolutePath = resolve(rootDir, normalizedPath);
  const relativeToImageRoot = relative(imageRoot, absolutePath);
  const errors = [];

  if (
    isAbsolute(sourcePath) ||
    relativeToImageRoot.startsWith("..") ||
    isAbsolute(relativeToImageRoot)
  ) {
    errors.push(`${changesetFile}: release-note image must live under ${RELEASE_IMAGE_ROOT}/`);
  }
  if (!RELEASE_IMAGE_EXTENSIONS.has(extname(normalizedPath).toLowerCase())) {
    errors.push(`${changesetFile}: unsupported release-note image extension: ${sourcePath}`);
  }
  if (!existsSync(absolutePath)) {
    errors.push(`${changesetFile}: release-note image does not exist: ${sourcePath}`);
  }
  if (!alt.trim()) {
    errors.push(`${changesetFile}: release-note image alt text cannot be empty`);
  }

  return {
    image: { locale, sourcePath: normalizedPath, alt: alt.trim() },
    errors
  };
}

function parseBody(rootDir, changesetFile, body) {
  const images = [];
  const errors = [];
  const summaryLines = [];

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(IMAGE_DIRECTIVE_PREFIX)) {
      summaryLines.push(line);
      continue;
    }

    const match = trimmed.match(IMAGE_DIRECTIVE_PATTERN);
    if (!match) {
      errors.push(
        `${changesetFile}: malformed release-note image directive; expected ` +
          "<!-- release-note-image: <zh-CN|en-US> | <path> | <alt> -->"
      );
      continue;
    }

    const validation = validateImage(rootDir, changesetFile, match[1], match[2].trim(), match[3]);
    images.push(validation.image);
    errors.push(...validation.errors);
  }

  return { summary: summaryLines.join("\n").trim(), images, errors };
}

function parseChangeset(rootDir, changesetFile) {
  const content = readFileSync(join(rootDir, changesetFile), "utf8");
  const headerMatch = content.match(CHANGESET_HEADER_PATTERN);
  if (!headerMatch) {
    return null;
  }

  const body = parseBody(rootDir, changesetFile, content.slice(headerMatch[0].length));
  return {
    id: changesetFile.split("/").at(-1).replace(/\.md$/, ""),
    file: changesetFile,
    packages: parsePackages(headerMatch[1]),
    summary: body.summary,
    images: body.images,
    errors: body.errors
  };
}

export function collectReleaseSummary(rootDir = process.cwd()) {
  const changesetDir = join(rootDir, ".changeset");
  if (!existsSync(changesetDir)) {
    return { schemaVersion: 1, changesets: [], images: [], errors: [] };
  }

  const appliedChangesets = readAppliedChangesets(changesetDir);
  const changesets = readdirSync(changesetDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        !appliedChangesets.has(entry.name.replace(/\.md$/, ""))
    )
    .map((entry) => parseChangeset(rootDir, `.changeset/${entry.name}`))
    .filter(Boolean)
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    schemaVersion: 1,
    changesets: changesets.map(({ id, file, packages, summary, images }) => ({
      id,
      file,
      packages,
      summary,
      images
    })),
    images: changesets.flatMap((changeset) =>
      changeset.images.map((image) => ({ changesetId: changeset.id, ...image }))
    ),
    errors: changesets.flatMap((changeset) => changeset.errors)
  };
}

function printHumanSummary(summary) {
  console.log(
    `Release summary: ${summary.changesets.length} changeset(s), ${summary.images.length} image(s)`
  );
  for (const image of summary.images) {
    console.log(`- ${image.changesetId} [${image.locale}] ${image.sourcePath}`);
  }
  for (const error of summary.errors) {
    console.error(`- ERROR ${error}`);
  }
}

function main() {
  const summary = collectReleaseSummary();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printHumanSummary(summary);
  }
  if (summary.errors.length > 0) {
    process.exitCode = 1;
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main();
}
