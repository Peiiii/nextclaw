#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = resolve(skillRoot, "assets/promo-page-template.html");

function usage() {
  return [
    "Usage:",
    "  node scripts/render-promo-page.mjs --brief <brief.json> --out <preview.html>",
    "",
    "The generated HTML embeds every local image and has no runtime dependencies.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") args.help = true;
    else if (token === "--brief" || token === "--out") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
      args[token.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return args;
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function requiredString(value, path) {
  invariant(typeof value === "string" && value.trim().length > 0, `${path} must be a non-empty string`);
}

function visibleLength(value) {
  return [...String(value).replace(/\s+/g, "")].length;
}

function mimeFor(filePath) {
  const extension = extname(filePath).toLowerCase();
  const mimeTypes = {
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  };
  const mime = mimeTypes[extension];
  invariant(mime, `Unsupported asset format: ${extension || "<none>"}`);
  return mime;
}

function resolveAssetPath(assetPath, briefDir) {
  requiredString(assetPath, "assets[].path");
  if (isAbsolute(assetPath)) return assetPath;
  invariant(!/^[a-z][a-z\d+.-]*:/i.test(assetPath), `Remote or protocol asset paths are not allowed: ${assetPath}`);
  return resolve(briefDir, assetPath);
}

function validateBrief(brief, briefPath) {
  invariant(brief && typeof brief === "object", "Brief must be a JSON object");
  invariant(brief.version === 1, "brief.version must be 1");
  requiredString(brief.page?.title, "page.title");
  requiredString(brief.page?.introduction, "page.introduction");
  if (brief.page.facts) {
    invariant(Array.isArray(brief.page.facts) && brief.page.facts.length === 3, "page.facts must contain exactly three labels");
    for (const [index, fact] of brief.page.facts.entries()) requiredString(fact, `page.facts[${index}]`);
  }
  if (brief.page.visualSectionTitle) requiredString(brief.page.visualSectionTitle, "page.visualSectionTitle");
  if (brief.page.visualSectionDescription) requiredString(brief.page.visualSectionDescription, "page.visualSectionDescription");
  if (brief.page.channel) {
    requiredString(brief.page.channel.label, "page.channel.label");
    requiredString(brief.page.channel.author, "page.channel.author");
    requiredString(brief.page.channel.handle, "page.channel.handle");
    requiredString(brief.page.channel.copy, "page.channel.copy");
  }
  invariant(Array.isArray(brief.claims) && brief.claims.length > 0, "claims must contain at least one claim");
  invariant(Array.isArray(brief.assets) && brief.assets.length > 0, "assets must contain at least one asset");
  invariant(Array.isArray(brief.cards) && brief.cards.length > 0, "cards must contain at least one card");

  const claims = new Map();
  for (const claim of brief.claims) {
    requiredString(claim.id, "claims[].id");
    requiredString(claim.text, `claims[${claim.id}].text`);
    invariant(!claims.has(claim.id), `Duplicate claim id: ${claim.id}`);
    invariant(["product", "data", "concept"].includes(claim.kind), `Unsupported claim kind for ${claim.id}`);
    claims.set(claim.id, claim);
  }

  const allowedRoles = new Set(["product-screenshot", "data-visual", "concept", "atmosphere"]);
  const assets = new Map();
  const briefDir = dirname(briefPath);
  for (const asset of brief.assets) {
    requiredString(asset.id, "assets[].id");
    requiredString(asset.alt, `assets[${asset.id}].alt`);
    invariant(!assets.has(asset.id), `Duplicate asset id: ${asset.id}`);
    invariant(allowedRoles.has(asset.role), `Unsupported role for asset ${asset.id}: ${asset.role}`);
    invariant(Array.isArray(asset.supports), `assets[${asset.id}].supports must be an array`);
    for (const claimId of asset.supports) invariant(claims.has(claimId), `Asset ${asset.id} supports unknown claim ${claimId}`);
    const absolutePath = resolveAssetPath(asset.path, briefDir);
    invariant(existsSync(absolutePath), `Asset does not exist: ${absolutePath}`);
    if (asset.role === "product-screenshot" || asset.role === "data-visual") {
      const capture = asset.capture;
      invariant(capture && typeof capture === "object", `Evidence asset ${asset.id} requires capture metadata`);
      requiredString(capture.subject, `assets[${asset.id}].capture.subject`);
      requiredString(capture.selectionReason, `assets[${asset.id}].capture.selectionReason`);
      invariant(
        ["full-window", "focused-panel", "intentional-detail"].includes(capture.scope),
        `Unsupported capture scope for asset ${asset.id}: ${capture.scope}`,
      );
      invariant(
        ["complete", "detail"].includes(capture.completeness),
        `Unsupported capture completeness for asset ${asset.id}: ${capture.completeness}`,
      );
      invariant(capture.privacyReviewed === true, `Evidence asset ${asset.id} must be privacy-reviewed`);
      if (capture.completeness === "complete") {
        invariant(capture.scope !== "intentional-detail", `Complete asset ${asset.id} cannot use intentional-detail scope`);
        invariant(!capture.sourceAssetId && !capture.cropRegion, `Complete asset ${asset.id} cannot declare a crop source`);
      } else {
        requiredString(capture.sourceAssetId, `assets[${asset.id}].capture.sourceAssetId`);
        invariant(capture.scope === "intentional-detail", `Detail asset ${asset.id} must use intentional-detail scope`);
        const crop = capture.cropRegion;
        invariant(crop && typeof crop === "object", `Detail asset ${asset.id} requires cropRegion`);
        for (const key of ["x", "y", "width", "height"]) {
          invariant(Number.isFinite(crop[key]) && crop[key] >= 0 && crop[key] <= 1, `Asset ${asset.id} cropRegion.${key} must be between 0 and 1`);
        }
        invariant(crop.width > 0 && crop.height > 0, `Asset ${asset.id} cropRegion must have positive size`);
        invariant(crop.x + crop.width <= 1 && crop.y + crop.height <= 1, `Asset ${asset.id} cropRegion exceeds its source`);
      }
    }
    assets.set(asset.id, { ...asset, absolutePath });
  }

  for (const asset of assets.values()) {
    if (asset.capture?.completeness !== "detail") continue;
    const source = assets.get(asset.capture.sourceAssetId);
    invariant(source, `Detail asset ${asset.id} references unknown source ${asset.capture.sourceAssetId}`);
    invariant(source.capture?.completeness === "complete", `Detail asset ${asset.id} must originate from complete evidence`);
    invariant(source.role === asset.role, `Detail asset ${asset.id} and its source must have the same role`);
  }

  for (const claim of claims.values()) {
    if (claim.kind === "concept") continue;
    const supportingAssets = [...assets.values()].filter((asset) => asset.supports.includes(claim.id));
    invariant(supportingAssets.length > 0, `Factual claim ${claim.id} has no supporting asset`);
    const expectedRole = claim.kind === "data" ? "data-visual" : "product-screenshot";
    invariant(
      supportingAssets.some((asset) => asset.role === expectedRole),
      `Claim ${claim.id} requires a supporting ${expectedRole}`,
    );
  }

  const layoutArchetypes = new Set([
    "centered-statement",
    "split-proof",
    "stacked-proof",
    "anchored-overlap",
    "full-bleed-caption",
    "step-sequence",
    "feature-collection",
    "comparison",
    "metric-proof",
    "testimonial",
    "gallery-mosaic",
    "closing-action",
  ]);
  const contentRoles = new Set(["orient", "explain", "prove", "sequence", "compare", "catalog", "synthesize", "act"]);
  const archetypesByLayout = new Map([
    ["hero-window", new Set(["stacked-proof"])],
    ["evidence-board", new Set(["split-proof"])],
    ["editorial", new Set(["anchored-overlap"])],
    ["full-bleed", new Set(["step-sequence"])],
  ]);
  const layouts = new Set(archetypesByLayout.keys());
  for (const [index, card] of brief.cards.entries()) {
    requiredString(card.title, `cards[${index}].title`);
    invariant(visibleLength(card.title) <= 24, `Card ${index} title exceeds the 24-character composition budget`);
    if (card.title.includes("\n")) {
      const titleLines = card.title.split("\n");
      invariant(titleLines.every((line) => line.trim().length > 0), `Card ${index} title contains an empty semantic line`);
      invariant(
        titleLines.every((line) => visibleLength(line) <= 12),
        `Card ${index} semantic title lines must not exceed 12 visible characters`,
      );
    }
    if (card.body) {
      invariant(visibleLength(card.body) <= 58, `Card ${index} body exceeds the 58-character composition budget`);
    }
    if (card.contentPoints) {
      invariant(Array.isArray(card.contentPoints), `cards[${index}].contentPoints must be an array`);
      invariant(
        card.contentPoints.length >= 2 && card.contentPoints.length <= 4,
        `Card ${index} contentPoints must contain two to four concrete points`,
      );
      for (const [pointIndex, point] of card.contentPoints.entries()) {
        requiredString(point, `cards[${index}].contentPoints[${pointIndex}]`);
        invariant(
          visibleLength(point) <= 14,
          `Card ${index} content point ${pointIndex} exceeds the 14-character composition budget`,
        );
      }
    }
    invariant(layouts.has(card.layout), `Unsupported layout for cards[${index}]: ${card.layout}`);
    const layoutDecision = card.layoutDecision;
    invariant(layoutDecision && typeof layoutDecision === "object", `cards[${index}].layoutDecision must be an object`);
    invariant(
      contentRoles.has(layoutDecision.contentRole),
      `Unsupported content role for cards[${index}]: ${layoutDecision.contentRole}`,
    );
    invariant(
      Array.isArray(layoutDecision.candidates) && layoutDecision.candidates.length >= 1 && layoutDecision.candidates.length <= 3,
      `cards[${index}].layoutDecision.candidates must contain one to three archetypes`,
    );
    for (const candidate of layoutDecision.candidates) {
      invariant(layoutArchetypes.has(candidate), `Card ${index} references unknown layout archetype ${candidate}`);
    }
    invariant(
      layoutDecision.candidates.includes(layoutDecision.archetypeId),
      `Card ${index} selected archetype must be included in layoutDecision.candidates`,
    );
    invariant(
      archetypesByLayout.get(card.layout).has(layoutDecision.archetypeId),
      `Card ${index} archetype ${layoutDecision.archetypeId} is not implemented by layout ${card.layout}`,
    );
    requiredString(layoutDecision.rationale, `cards[${index}].layoutDecision.rationale`);
    invariant(Array.isArray(card.claimIds) && card.claimIds.length > 0, `cards[${index}].claimIds must not be empty`);
    for (const claimId of card.claimIds) invariant(claims.has(claimId), `Card ${index} references unknown claim ${claimId}`);
    if (card.backgroundAssetId) invariant(assets.has(card.backgroundAssetId), `Card ${index} references unknown background asset`);
    const evidence = card.evidence;
    if (evidence) {
      invariant(typeof evidence === "object", `Card ${index} evidence must be an object`);
      invariant(Array.isArray(evidence.assetIds) && evidence.assetIds.length > 0, `Card ${index} evidence.assetIds must not be empty`);
      invariant(evidence.assetIds.length <= 3, `Card ${index} can present at most three evidence assets`);
      invariant(
        ["single", "sequence", "overview-with-details"].includes(evidence.composition),
        `Unsupported evidence composition for card ${index}: ${evidence.composition}`,
      );
      invariant(evidence.fit === "contain", `Card ${index} evidence.fit must be contain`);
      invariant(evidence.frameAspect === "source", `Card ${index} evidence.frameAspect must preserve source ratio`);
      requiredString(evidence.rationale, `cards[${index}].evidence.rationale`);
      for (const assetId of evidence.assetIds) invariant(assets.has(assetId), `Card ${index} references unknown evidence asset ${assetId}`);
      if (evidence.composition === "single") invariant(evidence.assetIds.length === 1, `Card ${index} single composition requires one asset`);
      if (evidence.composition === "sequence") invariant(evidence.assetIds.length >= 2, `Card ${index} sequence requires two or three assets`);
      if (evidence.composition === "overview-with-details") {
        invariant(evidence.assetIds.length >= 2, `Card ${index} overview-with-details requires an overview and at least one detail`);
      }
    }
    invariant(
      card.backgroundAssetId || evidence?.assetIds?.length,
      `Card ${index} must reference at least one visual asset`,
    );
    const cardClaims = card.claimIds.map((claimId) => claims.get(claimId));
    const factualClaims = cardClaims.filter((claim) => claim.kind !== "concept");
    const screenshotLayouts = new Set(["hero-window", "evidence-board", "editorial"]);
    if (screenshotLayouts.has(card.layout)) {
      invariant(evidence, `Card ${index} layout ${card.layout} requires evidence`);
    }
    if (card.layout === "full-bleed") {
      invariant(!evidence, `Card ${index} full-bleed cannot present product evidence`);
      invariant(factualClaims.length === 0, `Card ${index} full-bleed is concept-only and cannot carry factual claims`);
      invariant(
        Array.isArray(card.contentPoints) && card.contentPoints.length >= 2,
        `Card ${index} full-bleed must synthesize at least two concrete content points`,
      );
    }
    if (card.detailLabels) {
      invariant(
        card.layout === "evidence-board" && Array.isArray(card.detailLabels) && card.detailLabels.length === 3,
        `Card ${index} detailLabels must contain exactly three labels for evidence-board`,
      );
    }

    const evidenceAssets = evidence ? evidence.assetIds.map((assetId) => assets.get(assetId)) : [];
    for (const evidenceAsset of evidenceAssets) {
      invariant(
        evidenceAsset.role === "product-screenshot" || evidenceAsset.role === "data-visual",
        `Card ${index} evidence must reference product-screenshot or data-visual assets`,
      );
    }
    if (evidence?.composition === "overview-with-details") {
      invariant(evidenceAssets[0].capture.completeness === "complete", `Card ${index} overview must be complete evidence`);
      invariant(
        evidenceAssets.slice(1).every((asset) => asset.capture.completeness === "detail" && asset.capture.sourceAssetId === evidenceAssets[0].id),
        `Card ${index} details must be declared crops of its overview`,
      );
    } else if (evidenceAssets.length > 0) {
      invariant(
        evidenceAssets.every((asset) => asset.capture.completeness === "complete"),
        `Card ${index} ${evidence.composition} composition accepts complete evidence only`,
      );
    }
    for (const claimId of card.claimIds) {
      const claim = claims.get(claimId);
      if (claim.kind === "concept") continue;
      const completeEvidence = evidenceAssets.filter((asset) => asset.capture.completeness === "complete");
      invariant(completeEvidence.length > 0, `Card ${index} has a factual claim but no complete screenshot evidence`);
      invariant(
        completeEvidence.some((asset) => asset.supports.includes(claimId)),
        `Card ${index} has no complete evidence supporting claim ${claimId}`,
      );
      const expectedRole = claim.kind === "data" ? "data-visual" : "product-screenshot";
      invariant(
        completeEvidence.some((asset) => asset.role === expectedRole && asset.supports.includes(claimId)),
        `Card ${index} claim ${claimId} requires a complete ${expectedRole}`,
      );
    }
  }

  return { assets, claims };
}

function embedAssets(assets) {
  return Object.fromEntries(
    [...assets.values()].map((asset) => {
      const mime = mimeFor(asset.absolutePath);
      const data = readFileSync(asset.absolutePath).toString("base64");
      return [asset.id, { ...asset, src: `data:${mime};base64,${data}`, absolutePath: undefined }];
    }),
  );
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  invariant(args.brief, "--brief is required");
  invariant(args.out, "--out is required");

  const briefPath = resolve(args.brief);
  const outputPath = resolve(args.out);
  invariant(existsSync(briefPath), `Brief does not exist: ${briefPath}`);
  invariant(existsSync(templatePath), `Template does not exist: ${templatePath}`);

  const brief = JSON.parse(readFileSync(briefPath, "utf8"));
  const { assets, claims } = validateBrief(brief, briefPath);
  const payload = { brief, embeddedAssets: embedAssets(assets) };
  const template = readFileSync(templatePath, "utf8");
  invariant(template.includes("__PROMO_PAGE_DATA__"), "Template data placeholder is missing");
  const html = template.replace("__PROMO_PAGE_DATA__", safeJson(payload));

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html, "utf8");
  process.stdout.write(
    `${JSON.stringify({ output: outputPath, claims: claims.size, assets: assets.size, cards: brief.cards.length, embedded: true })}\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`[promo-page] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
