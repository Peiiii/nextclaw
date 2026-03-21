import {
  HOTSPOT_LOG_SECTION_TITLE,
  inspectHotspotLogBlock,
  listTouchedMaintainabilityHotspots
} from "../../../../scripts/maintainability-hotspots.mjs";
import {
  countLinesInText,
  getHeadContent,
  normalizePath,
  readFileText,
  ROOT,
  runGit
} from "./maintainability-guard-support.mjs";
import fs from "node:fs";
import path from "node:path";

const ITERATION_README_PATTERN = /^docs\/logs\/v\d+\.\d+\.\d+-[^/]+\/README\.md$/;
const ITERATION_DIR_PATTERN = /^docs\/logs\/v\d+\.\d+\.\d+-[^/]+\/?$/;

function resolveIterationReadmes(pathText, fileExists) {
  const normalizedPath = normalizePath(pathText);
  if (!normalizedPath) {
    return [];
  }
  if (ITERATION_README_PATTERN.test(normalizedPath)) {
    return fileExists(normalizedPath) ? [normalizedPath] : [];
  }
  if (!ITERATION_DIR_PATTERN.test(normalizedPath)) {
    return [];
  }
  const readmePath = normalizedPath.endsWith("/README.md")
    ? normalizedPath
    : `${normalizedPath.replace(/\/$/, "")}/README.md`;
  return fileExists(readmePath) ? [readmePath] : [];
}

export function extractChangedIterationReadmes({ candidatePaths = [], statusOutput = "", fileExists } = {}) {
  const pathExists = fileExists ?? ((pathText) => {
    const absolutePath = path.resolve(ROOT, pathText);
    return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
  });
  const readmes = [];

  for (const candidatePath of candidatePaths) {
    readmes.push(...resolveIterationReadmes(candidatePath, pathExists));
  }

  for (const line of statusOutput.split(/\r?\n/)) {
    if (!line) {
      continue;
    }
    let payload = line.slice(3);
    if (payload.includes(" -> ")) {
      payload = payload.split(" -> ", 2)[1];
    }
    readmes.push(...resolveIterationReadmes(payload, pathExists));
  }

  return [...new Set(readmes)];
}

export function listChangedIterationReadmes(candidatePaths = []) {
  return extractChangedIterationReadmes({
    candidatePaths,
    statusOutput: runGit(["status", "--porcelain"])
  });
}

export function collectHotspotGovernanceFindings(inspectedPaths, candidatePaths = []) {
  const hotspots = listTouchedMaintainabilityHotspots(inspectedPaths);
  if (hotspots.length === 0) {
    return [];
  }

  const readmePaths = listChangedIterationReadmes(candidatePaths);
  const readmes = readmePaths.map((readmePath) => ({
    path: readmePath,
    text: readFileText(readmePath)
  }));
  const findings = [];

  for (const hotspot of hotspots) {
    const currentContent = readFileText(hotspot.path);
    const currentLines = countLinesInText(currentContent);
    const previousContent = getHeadContent(hotspot.path);
    const previousLines = previousContent == null ? null : countLinesInText(previousContent);
    const deltaLines = previousLines == null ? null : currentLines - previousLines;
    const matchingReadme = readmes.find(({ text }) => {
      if (!text.includes(HOTSPOT_LOG_SECTION_TITLE)) {
        return false;
      }
      const coverage = inspectHotspotLogBlock(text, hotspot.path);
      return coverage.found && coverage.missingFields.length === 0;
    });

    if (!matchingReadme) {
      const missingLogMessage = readmes.length === 0
        ? "touched hotspot file requires a docs/logs iteration README with hotspot debt notes"
        : "touched hotspot file is missing a complete hotspot debt note in the changed iteration README";
      const missingFields = readmes.length === 0
        ? ["红区触达与减债记录", "本次是否减债", "说明", "下一步拆分缝"]
        : (() => {
            const firstRelevantReadme = readmes.find(({ text }) => text.includes(HOTSPOT_LOG_SECTION_TITLE)) ?? readmes[0];
            const coverage = inspectHotspotLogBlock(firstRelevantReadme.text, hotspot.path);
            return coverage.found ? coverage.missingFields : ["### hotspot-path block", "本次是否减债", "说明", "下一步拆分缝"];
          })();

      findings.push({
        level: "error",
        source: "hotspot-governance",
        path: hotspot.path,
        category: "hotspot",
        budget: null,
        current_lines: currentLines,
        previous_lines: previousLines,
        delta_lines: deltaLines,
        message: `${missingLogMessage}; missing=${missingFields.join(", ")}`,
        suggested_seam: hotspot.nextSplitSeam,
        rule_id: "hotspot-touch-log",
        symbol_name: null,
        line: null,
        end_line: null,
        metric_value: null,
        previous_metric_value: null,
        matched_signals: [hotspot.chain]
      });
      continue;
    }

    findings.push({
      level: "warn",
      source: "hotspot-governance",
      path: hotspot.path,
      category: "hotspot",
      budget: null,
      current_lines: currentLines,
      previous_lines: previousLines,
      delta_lines: deltaLines,
      message: `touched hotspot file with debt note recorded in ${matchingReadme.path}`,
      suggested_seam: hotspot.nextSplitSeam,
      rule_id: "hotspot-touch-log",
      symbol_name: null,
      line: null,
      end_line: null,
      metric_value: null,
      previous_metric_value: null,
      matched_signals: [hotspot.chain]
    });
  }

  return findings;
}
