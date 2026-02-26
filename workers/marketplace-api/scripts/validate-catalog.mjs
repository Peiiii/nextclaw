import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function fail(message) {
  throw new Error(message);
}

function expectNonEmptyString(value, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${path} must be a non-empty string`);
  }
  return value.trim();
}

function expectStringArray(value, path) {
  if (!Array.isArray(value)) {
    fail(`${path} must be an array`);
  }
  return value.map((entry, index) => expectNonEmptyString(entry, `${path}[${index}]`));
}

function expectObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${path} must be an object`);
  }
  return value;
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(scriptDir, "../data/catalog.json");
const raw = readFileSync(catalogPath, "utf8");
const catalog = JSON.parse(raw);

expectObject(catalog, "catalog");

const version = expectNonEmptyString(catalog.version, "catalog.version");
const generatedAt = expectNonEmptyString(catalog.generatedAt, "catalog.generatedAt");
if (Number.isNaN(Date.parse(generatedAt))) {
  fail("catalog.generatedAt must be a valid datetime string");
}

const supportedKinds = new Set(["npm", "clawhub", "git", "builtin"]);
const seenGlobalIds = new Set();
const seenGlobalSlugs = new Set();
const seenGlobalSpecs = new Set();

function validateSection(sectionName, expectedType) {
  const section = expectObject(catalog[sectionName], `catalog.${sectionName}`);

  if (!Array.isArray(section.items)) {
    fail(`catalog.${sectionName}.items must be an array`);
  }
  if (!Array.isArray(section.recommendations)) {
    fail(`catalog.${sectionName}.recommendations must be an array`);
  }

  const sectionItemIds = new Set();
  const sectionRecommendationIds = new Set();

  for (let index = 0; index < section.items.length; index += 1) {
    const item = section.items[index];
    const path = `catalog.${sectionName}.items[${index}]`;
    expectObject(item, path);

    const id = expectNonEmptyString(item.id, `${path}.id`);
    const slug = expectNonEmptyString(item.slug, `${path}.slug`);
    const type = expectNonEmptyString(item.type, `${path}.type`);
    if (type !== expectedType) {
      fail(`${path}.type must be ${expectedType}`);
    }

    expectNonEmptyString(item.name, `${path}.name`);
    expectNonEmptyString(item.summary, `${path}.summary`);
    expectStringArray(item.tags, `${path}.tags`);
    expectNonEmptyString(item.author, `${path}.author`);
    expectNonEmptyString(item.publishedAt, `${path}.publishedAt`);
    expectNonEmptyString(item.updatedAt, `${path}.updatedAt`);

    if (seenGlobalIds.has(id)) {
      fail(`${path}.id duplicates with ${id}`);
    }
    seenGlobalIds.add(id);
    sectionItemIds.add(id);

    if (seenGlobalSlugs.has(slug)) {
      fail(`${path}.slug duplicates with ${slug}`);
    }
    seenGlobalSlugs.add(slug);

    const install = expectObject(item.install, `${path}.install`);
    const kind = expectNonEmptyString(install.kind, `${path}.install.kind`);
    if (!supportedKinds.has(kind)) {
      fail(`${path}.install.kind is invalid`);
    }

    const spec = expectNonEmptyString(install.spec, `${path}.install.spec`);
    expectNonEmptyString(install.command, `${path}.install.command`);

    const specKey = `${type}:${kind}:${spec}`.toLowerCase();
    if (seenGlobalSpecs.has(specKey)) {
      fail(`${path}.install.spec duplicates with ${type}/${kind}/${spec}`);
    }
    seenGlobalSpecs.add(specKey);
  }

  for (let index = 0; index < section.recommendations.length; index += 1) {
    const recommendation = section.recommendations[index];
    const path = `catalog.${sectionName}.recommendations[${index}]`;
    expectObject(recommendation, path);

    const recommendationId = expectNonEmptyString(recommendation.id, `${path}.id`);
    if (sectionRecommendationIds.has(recommendationId)) {
      fail(`${path}.id duplicates with ${recommendationId}`);
    }
    sectionRecommendationIds.add(recommendationId);

    expectNonEmptyString(recommendation.title, `${path}.title`);
    const itemIds = expectStringArray(recommendation.itemIds, `${path}.itemIds`);
    for (const itemId of itemIds) {
      if (!sectionItemIds.has(itemId)) {
        fail(`${path}.itemIds contains unknown ${expectedType} item id: ${itemId}`);
      }
    }
  }

  return {
    items: section.items.length,
    recommendations: section.recommendations.length
  };
}

const pluginStats = validateSection("plugins", "plugin");
const skillStats = validateSection("skills", "skill");

console.log(
  `catalog validation passed: version=${version}, plugins=${pluginStats.items}/${pluginStats.recommendations}, skills=${skillStats.items}/${skillStats.recommendations}`
);
