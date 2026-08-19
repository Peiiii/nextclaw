import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CHANGESET_HEADER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const CONTENT_FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const IMAGE_DIRECTIVE_PREFIX = "<!-- release-note-image:";
const IMAGE_DIRECTIVE_PATTERN =
  /^<!-- release-note-image:\s*(zh-CN|en-US)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*-->$/;
const BLOG_DIRECTIVE_PREFIX = "<!-- release-note-blog:";
const BLOG_DIRECTIVE_PATTERN = /^<!-- release-note-blog:\s*([^|]+?)\s*-->$/;
const RELEASE_IMAGE_ROOT = "images/screenshots";
const RELEASE_IMAGE_EXTENSIONS = new Set([".jpeg", ".jpg", ".png", ".webp"]);
const BLOG_DRAFT_ROOT = "docs/blog-drafts";
const BLOG_TARGET = "next-stable";
const BLOG_ROOTS = {
  "zh-CN": "apps/docs/zh/blog",
  "en-US": "apps/docs/en/blog",
};

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
    errors,
  };
}

function validatePathUnderRoot(rootDir, ownerFile, sourcePath, allowedRoot, label) {
  const normalizedPath = sourcePath.replaceAll("\\", "/");
  const absoluteRoot = resolve(rootDir, allowedRoot);
  const absolutePath = resolve(rootDir, normalizedPath);
  const relativeToRoot = relative(absoluteRoot, absolutePath);
  const errors = [];

  if (
    isAbsolute(sourcePath) ||
    relativeToRoot.startsWith("..") ||
    isAbsolute(relativeToRoot)
  ) {
    errors.push(`${ownerFile}: ${label} must live under ${allowedRoot}/`);
  }
  if (extname(normalizedPath).toLowerCase() !== ".md") {
    errors.push(`${ownerFile}: ${label} must be a Markdown file: ${sourcePath}`);
  }
  if (!existsSync(absolutePath)) {
    errors.push(`${ownerFile}: ${label} does not exist: ${sourcePath}`);
  }

  return { normalizedPath, errors };
}

function validateBlogNavigation(rootDir, ownerFile, locale, sourcePath) {
  const localeSegment = locale === "zh-CN" ? "zh" : "en";
  const slug = basename(sourcePath, ".md");
  const route = `/${localeSegment}/blog/${slug}`;
  const indexPath = join(rootDir, `apps/docs/${localeSegment}/blog/index.md`);
  const navigationPath = join(
    rootDir,
    "apps/docs/.vitepress/navigation/docs-navigation.config.ts",
  );
  const errors = [];

  if (!existsSync(indexPath) || !readFileSync(indexPath, "utf8").includes(slug)) {
    errors.push(`${ownerFile}: ${locale} blog index is missing ${slug}`);
  }
  if (!existsSync(navigationPath) || !readFileSync(navigationPath, "utf8").includes(route)) {
    errors.push(`${ownerFile}: ${locale} blog sidebar is missing ${route}`);
  }

  return errors;
}

function parseFrontmatterFields(content) {
  const match = content.match(CONTENT_FRONTMATTER_PATTERN);
  if (!match) {
    return {};
  }
  return Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*?)\s*$/))
      .filter(Boolean)
      .map((entry) => {
        const rawValue = entry[2];
        const value = rawValue.match(/^(["'])(.*)\1$/)?.[2] ?? rawValue;
        return [entry[1], value];
      }),
  );
}

function validateReadyBlogPath(rootDir, ownerFile, locale, sourcePath) {
  if (!sourcePath) {
    return {
      normalizedPath: null,
      errors: [`${ownerFile}: ${locale} ready blog path is required`],
    };
  }
  const validation = validatePathUnderRoot(
    rootDir,
    ownerFile,
    sourcePath,
    BLOG_ROOTS[locale],
    `${locale} release-note blog`,
  );
  if (validation.errors.length === 0) {
    validation.errors.push(
      ...validateBlogNavigation(rootDir, ownerFile, locale, validation.normalizedPath),
    );
  }
  return validation;
}

function validateBlogDraft(rootDir, sourcePath, requireReadyBlogs) {
  const ownerFile = sourcePath;
  const sourceValidation = validatePathUnderRoot(
    rootDir,
    ownerFile,
    sourcePath,
    BLOG_DRAFT_ROOT,
    "release-note blog draft",
  );
  const errors = [...sourceValidation.errors];
  if (!sourceValidation.normalizedPath.endsWith(".blog-draft.md")) {
    errors.push(`${ownerFile}: release-note blog draft must end with .blog-draft.md`);
  }

  const content = existsSync(resolve(rootDir, sourceValidation.normalizedPath))
    ? readFileSync(resolve(rootDir, sourceValidation.normalizedPath), "utf8")
    : "";
  const fields = parseFrontmatterFields(content);
  const state = fields.releaseBlogState;
  const changesetId = fields.releaseBlogChangeset;

  if (fields.releaseBlogTarget !== BLOG_TARGET) {
    errors.push(`${ownerFile}: releaseBlogTarget must be ${BLOG_TARGET}`);
  }
  if (!changesetId) {
    errors.push(`${ownerFile}: releaseBlogChangeset is required`);
  }
  if (!["draft", "ready"].includes(state)) {
    errors.push(`${ownerFile}: releaseBlogState must be draft or ready`);
  }
  if (state === "draft" && requireReadyBlogs) {
    errors.push(
      `${ownerFile}: release-note blog is still a draft; prepare zh-CN and en-US articles and mark it ready`,
    );
  }

  const blog = {
    changesetId: changesetId ?? null,
    state: state ?? "invalid",
    target: fields.releaseBlogTarget ?? null,
    sourcePath: sourceValidation.normalizedPath,
  };
  if (state === "ready") {
    const zhValidation = validateReadyBlogPath(
      rootDir,
      ownerFile,
      "zh-CN",
      fields.releaseBlogZhPath,
    );
    const enValidation = validateReadyBlogPath(
      rootDir,
      ownerFile,
      "en-US",
      fields.releaseBlogEnPath,
    );
    errors.push(...zhValidation.errors, ...enValidation.errors);
    blog.zhSourcePath = zhValidation.normalizedPath;
    blog.enSourcePath = enValidation.normalizedPath;
  }

  return { blog, errors };
}

function collectReleaseBlogDrafts(rootDir, requireReadyBlogs) {
  const draftDirectory = join(rootDir, BLOG_DRAFT_ROOT);
  if (!existsSync(draftDirectory)) {
    return { blogs: [], errors: [] };
  }
  const validations = readdirSync(draftDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".blog-draft.md"))
    .filter((entry) => {
      const content = readFileSync(join(draftDirectory, entry.name), "utf8");
      return Boolean(parseFrontmatterFields(content).releaseBlogTarget);
    })
    .map((entry) =>
      validateBlogDraft(
        rootDir,
        `${BLOG_DRAFT_ROOT}/${entry.name}`,
        requireReadyBlogs,
      ),
    );
  return {
    blogs: validations.map((validation) => validation.blog),
    errors: validations.flatMap((validation) => validation.errors),
  };
}

function parseBody(rootDir, changesetFile, body) {
  const images = [];
  const blogReferences = [];
  const errors = [];
  const summaryLines = [];

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith(BLOG_DIRECTIVE_PREFIX)) {
      const match = trimmed.match(BLOG_DIRECTIVE_PATTERN);
      if (!match) {
        errors.push(
          `${changesetFile}: malformed release-note blog directive; expected ` +
            "<!-- release-note-blog: docs/blog-drafts/<file>.blog-draft.md -->",
        );
        continue;
      }
      const validation = validatePathUnderRoot(
        rootDir,
        changesetFile,
        match[1].trim(),
        BLOG_DRAFT_ROOT,
        "release-note blog draft",
      );
      if (!validation.normalizedPath.endsWith(".blog-draft.md")) {
        validation.errors.push(
          `${changesetFile}: release-note blog draft must end with .blog-draft.md`,
        );
      }
      blogReferences.push(validation.normalizedPath);
      errors.push(...validation.errors);
      continue;
    }
    if (!trimmed.startsWith(IMAGE_DIRECTIVE_PREFIX)) {
      summaryLines.push(line);
      continue;
    }

    const match = trimmed.match(IMAGE_DIRECTIVE_PATTERN);
    if (!match) {
      errors.push(
        `${changesetFile}: malformed release-note image directive; expected ` +
          "<!-- release-note-image: <zh-CN|en-US> | <path> | <alt> -->",
      );
      continue;
    }

    const validation = validateImage(rootDir, changesetFile, match[1], match[2].trim(), match[3]);
    images.push(validation.image);
    errors.push(...validation.errors);
  }

  return { summary: summaryLines.join("\n").trim(), images, blogReferences, errors };
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
    blogReferences: body.blogReferences,
    errors: body.errors,
  };
}

function collectPendingChangesets(rootDir) {
  const changesetDir = join(rootDir, ".changeset");
  if (!existsSync(changesetDir)) {
    return [];
  }
  const appliedChangesets = readAppliedChangesets(changesetDir);
  return readdirSync(changesetDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        !appliedChangesets.has(entry.name.replace(/\.md$/, "")),
    )
    .map((entry) => parseChangeset(rootDir, `.changeset/${entry.name}`))
    .filter(Boolean)
    .sort((left, right) => left.id.localeCompare(right.id));
}

function associateBlogsWithChangesets(changesets, blogs) {
  const errors = [];
  const blogByPath = new Map(blogs.map((blog) => [blog.sourcePath, blog]));
  const changesetById = new Map(changesets.map((changeset) => [changeset.id, changeset]));

  for (const changeset of changesets) {
    changeset.blogs = changeset.blogReferences.flatMap((sourcePath) => {
      const blog = blogByPath.get(sourcePath);
      if (!blog) {
        errors.push(`${changeset.file}: linked blog draft is not registered: ${sourcePath}`);
        return [];
      }
      if (blog.changesetId !== changeset.id) {
        errors.push(
          `${changeset.file}: linked blog declares changeset ${blog.changesetId ?? "<missing>"}: ${sourcePath}`,
        );
      }
      return [blog];
    });
  }

  for (const blog of blogs) {
    const changeset = changesetById.get(blog.changesetId);
    if (changeset && !changeset.blogReferences.includes(blog.sourcePath)) {
      errors.push(`${changeset.file}: missing release-note-blog directive for ${blog.sourcePath}`);
    }
  }

  return errors;
}

export function collectReleaseSummary(rootDir = process.cwd(), options = {}) {
  const requireReadyBlogs = options.requireReadyBlogs ?? false;
  const changesets = collectPendingChangesets(rootDir);
  const blogCollection = collectReleaseBlogDrafts(rootDir, requireReadyBlogs);
  const associationErrors = associateBlogsWithChangesets(changesets, blogCollection.blogs);

  return {
    schemaVersion: 1,
    changesets: changesets.map(
      ({ id, file, packages, summary, images, blogs = [] }) => ({
        id,
        file,
        packages,
        summary,
        images,
        blogs,
      }),
    ),
    images: changesets.flatMap((changeset) =>
      changeset.images.map((image) => ({ changesetId: changeset.id, ...image })),
    ),
    blogs: blogCollection.blogs,
    errors: [
      ...changesets.flatMap((changeset) => changeset.errors),
      ...blogCollection.errors,
      ...associationErrors,
    ],
  };
}

function printHumanSummary(summary) {
  console.log(
    `Release summary: ${summary.changesets.length} changeset(s), ${summary.images.length} image(s), ${summary.blogs.length} blog(s)`,
  );
  for (const image of summary.images) {
    console.log(`- ${image.changesetId} [${image.locale}] ${image.sourcePath}`);
  }
  for (const blog of summary.blogs) {
    const publishedPaths =
      blog.state === "ready" ? ` -> ${blog.zhSourcePath}, ${blog.enSourcePath}` : "";
    console.log(
      `- ${blog.changesetId ?? "<unbound>"} [blog:${blog.state}] ${blog.sourcePath}${publishedPaths}`,
    );
  }
  for (const error of summary.errors) {
    console.error(`- ERROR ${error}`);
  }
}

function main() {
  const summary = collectReleaseSummary(process.cwd(), {
    requireReadyBlogs: process.argv.includes("--require-ready-blogs"),
  });
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
