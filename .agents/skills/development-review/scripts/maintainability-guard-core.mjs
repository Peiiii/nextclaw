import {
  chooseBudget,
  collectDisableCommentFindings,
  countLinesInText,
  getHeadContent,
  inspectNamingResponsibility,
  isCodePath,
  normalizePath,
  parseChangedPatch,
  rangeIntersectsChanged,
  readFileText,
  suggestSeam
} from "./maintainability-guard-support.mjs";
import { summarizeRepoLineChanges } from "./maintainability-guard-line-changes.mjs";
import { collectDirectoryBudgetFindings } from "./maintainability-guard-directory-budget.mjs";
import { collectHotspotGovernanceFindings } from "./maintainability-guard-hotspots.mjs";
import { buildSignature, lintContent } from "./maintainability-guard-lint.mjs";

function toPayload(item) {
  return {
    level: item.level,
    source: item.source,
    path: item.path,
    category: item.category,
    budget: item.budget,
    current_lines: item.current_lines,
    previous_lines: item.previous_lines,
    delta_lines: item.delta_lines,
    message: item.message,
    suggested_seam: item.suggested_seam,
    rule_id: item.rule_id ?? null,
    symbol_name: item.symbol_name ?? null,
    line: item.line ?? null,
    end_line: item.end_line ?? null,
    metric_value: item.metric_value ?? null,
    previous_metric_value: item.previous_metric_value ?? null,
    naming_role: item.naming_role ?? null,
    matched_signals: item.matched_signals ?? null,
    current_count: item.current_count ?? null,
    previous_count: item.previous_count ?? null,
    delta_count: item.delta_count ?? null,
    exception_path: item.exception_path ?? null,
    exception_reason: item.exception_reason ?? null
  };
}

function createFileBudgetFinding(level, pathText, category, budget, currentLines, previousLines, deltaLines, message, suggestedSeam) {
  return {
    level,
    source: "file-budget",
    path: pathText,
    category,
    budget,
    current_lines: currentLines,
    previous_lines: previousLines,
    delta_lines: deltaLines,
    message,
    suggested_seam: suggestedSeam
  };
}

export async function inspectPaths(paths, options = {}) {
  const inspectedPaths = [];
  const findings = [];
  const lineChangeSummary = summarizeRepoLineChanges({
    candidatePaths: options.scopePaths ?? null
  });

  for (const rawPath of paths) {
    const pathText = normalizePath(rawPath);
    if (!pathText || !isCodePath(pathText)) {
      continue;
    }

    let currentContent;
    try {
      currentContent = readFileText(pathText);
    } catch {
      continue;
    }

    const currentLines = countLinesInText(currentContent);
    const previousContent = getHeadContent(pathText);
    const previousLines = previousContent == null ? null : countLinesInText(previousContent);
    const deltaLines = previousLines == null ? null : currentLines - previousLines;
    const budget = chooseBudget(pathText);
    const seam = suggestSeam(pathText);
    const { changedLines, addedLines, isNewFile } = parseChangedPatch(pathText);

    inspectedPaths.push(pathText);

    if (previousLines == null && currentLines > budget.maxLines) {
      findings.push(createFileBudgetFinding("error", pathText, budget.category, budget.maxLines, currentLines, previousLines, deltaLines, "new file exceeds maintainability budget", seam));
    } else if (previousLines != null && previousLines <= budget.maxLines && currentLines > budget.maxLines) {
      findings.push(createFileBudgetFinding("error", pathText, budget.category, budget.maxLines, currentLines, previousLines, deltaLines, "file crossed from within budget to over budget", seam));
    } else if (previousLines != null && previousLines > budget.maxLines && currentLines > previousLines) {
      findings.push(createFileBudgetFinding("error", pathText, budget.category, budget.maxLines, currentLines, previousLines, deltaLines, "already oversized file kept growing", seam));
    } else if (currentLines > budget.maxLines) {
      findings.push(createFileBudgetFinding("warn", pathText, budget.category, budget.maxLines, currentLines, previousLines, deltaLines, "file remains over its maintainability budget", seam));
    } else if (currentLines >= Math.floor(budget.maxLines * 0.8)) {
      findings.push(createFileBudgetFinding("warn", pathText, budget.category, budget.maxLines, currentLines, previousLines, deltaLines, "file is near its maintainability budget", seam));
    } else if (deltaLines != null && deltaLines >= 120) {
      findings.push(createFileBudgetFinding("warn", pathText, budget.category, budget.maxLines, currentLines, previousLines, deltaLines, "file grew materially in this change", seam));
    }

    findings.push(
      ...collectDisableCommentFindings({
        pathText,
        category: budget.category,
        currentLines,
        previousLines,
        deltaLines,
        addedLines
      })
    );

    const currentNamingFindings = inspectNamingResponsibility(pathText, currentContent);
    const previousNamingSignatures = new Set(
      (previousContent == null ? [] : inspectNamingResponsibility(pathText, previousContent))
        .map((finding) => `${finding.ruleId}::${finding.role}`)
    );

    for (const namingFinding of currentNamingFindings) {
      const signature = `${namingFinding.ruleId}::${namingFinding.role}`;
      const existedBefore = previousNamingSignatures.has(signature);
      let level = "error";
      let message = namingFinding.message;

      if (previousContent == null) {
        message = "new file name does not match its primary responsibility";
      } else if (existedBefore) {
        level = "warn";
        message = "touched file name still does not match its primary responsibility";
      } else {
        message = "changed file introduced a new file-name-to-responsibility mismatch";
      }

      findings.push({
        level,
        source: "filename-role",
        path: pathText,
        category: "naming",
        budget: null,
        current_lines: currentLines,
        previous_lines: previousLines,
        delta_lines: deltaLines,
        message,
        suggested_seam: namingFinding.suggestedSeam,
        rule_id: namingFinding.ruleId,
        symbol_name: null,
        line: null,
        end_line: null,
        metric_value: null,
        previous_metric_value: null,
        naming_role: namingFinding.role,
        matched_signals: namingFinding.matchedSignals
      });
    }

    const currentLintFindings = await lintContent(pathText, currentContent);
    const previousLintFindings = previousContent == null ? [] : await lintContent(pathText, previousContent);
    const previousBySignature = new Map(
      previousLintFindings
        .map((finding) => [buildSignature(finding), finding])
        .filter(([signature]) => signature)
    );

    for (const lintFinding of currentLintFindings) {
      const signature = buildSignature(lintFinding);
      const previousLint = signature ? previousBySignature.get(signature) : null;
      const changedOverlap = isNewFile || rangeIntersectsChanged(lintFinding.line, lintFinding.endLine, changedLines);

      let level = null;
      let message = lintFinding.message;
      const previousMetricValue = previousLint?.metricValue ?? null;

      if (previousContent == null) {
        level = "error";
        message = "new file introduced a function-level maintainability violation";
      } else if (previousLint) {
        if (
          lintFinding.metricValue != null &&
          previousLint.metricValue != null &&
          lintFinding.metricValue > previousLint.metricValue
        ) {
          level = "error";
          message = "existing function-level maintainability violation got worse";
        } else if (changedOverlap) {
          level = "warn";
          message = "touched function still exceeds maintainability rule";
        }
      } else if (changedOverlap) {
        level = "error";
        message = "changed function introduced a new maintainability violation";
      }

      if (!level) {
        continue;
      }

      findings.push({
        level,
        source: "eslint-function-budget",
        path: pathText,
        category: budget.category,
        budget: budget.maxLines,
        current_lines: currentLines,
        previous_lines: previousLines,
        delta_lines: deltaLines,
        message,
        suggested_seam: suggestSeam(pathText, lintFinding.ruleId),
        rule_id: lintFinding.ruleId,
        symbol_name: lintFinding.symbolName,
        line: lintFinding.line,
        end_line: lintFinding.endLine,
        metric_value: lintFinding.metricValue,
        previous_metric_value: previousMetricValue
      });
    }
  }

  findings.push(...collectDirectoryBudgetFindings(inspectedPaths));

  if (options.changeKind === "non-feature" && lineChangeSummary.non_test.net > 0) {
    findings.push({
      level: "error",
      source: "line-change-gate",
      path: "(change-set)",
      category: "line-change",
      budget: null,
      current_lines: null,
      previous_lines: null,
      delta_lines: lineChangeSummary.non_test.net,
      message: `non-feature change increased non-test code by ${lineChangeSummary.non_test.net} lines; keep non-test net growth <= 0 before passing validation`,
      suggested_seam: "delete obsolete paths, collapse duplicate branches, or simplify the implementation until non-test net growth is no longer positive",
      rule_id: "non-feature-net-non-test-growth",
      symbol_name: null,
      line: null,
      end_line: null,
      metric_value: lineChangeSummary.non_test.net,
      previous_metric_value: 0
    });
  }

  findings.sort((left, right) => {
    if ((left.level === "error") !== (right.level === "error")) {
      return left.level === "error" ? -1 : 1;
    }
    if (left.path !== right.path) {
      return left.path.localeCompare(right.path);
    }
    if ((left.line ?? 0) !== (right.line ?? 0)) {
      return (left.line ?? 0) - (right.line ?? 0);
    }
    if ((left.rule_id ?? "") !== (right.rule_id ?? "")) {
      return (left.rule_id ?? "").localeCompare(right.rule_id ?? "");
    }
    return left.message.localeCompare(right.message);
  });

  findings.push(...collectHotspotGovernanceFindings(inspectedPaths, paths));
  findings.sort((left, right) => {
    if ((left.level === "error") !== (right.level === "error")) {
      return left.level === "error" ? -1 : 1;
    }
    if (left.path !== right.path) {
      return left.path.localeCompare(right.path);
    }
    if ((left.line ?? 0) !== (right.line ?? 0)) {
      return (left.line ?? 0) - (right.line ?? 0);
    }
    if ((left.rule_id ?? "") !== (right.rule_id ?? "")) {
      return (left.rule_id ?? "").localeCompare(right.rule_id ?? "");
    }
    return left.message.localeCompare(right.message);
  });

  return {
    applicable: inspectedPaths.length > 0 || lineChangeSummary.has_code_changes,
    change_kind: options.changeKind ?? "auto",
    inspected_paths: inspectedPaths,
    line_change_summary: lineChangeSummary,
    summary: {
      errors: findings.filter((item) => item.level === "error").length,
      warnings: findings.filter((item) => item.level === "warn").length
    },
    findings: findings.map(toPayload),
    file_findings: findings.filter((item) => item.source === "file-budget").map(toPayload),
    directory_findings: findings.filter((item) => item.source === "directory-budget").map(toPayload),
    function_findings: findings.filter((item) => item.source === "eslint-function-budget" || item.source === "disable-comment").map(toPayload),
    naming_findings: findings.filter((item) => item.source === "filename-role").map(toPayload),
    hotspot_findings: findings.filter((item) => item.source === "hotspot-governance").map(toPayload)
  };
}

export function printHuman(report) {
  if (!report.applicable) {
    console.log("Maintainability check not applicable: no changed code-like files found.");
    return;
  }

  console.log("Maintainability check report");
  console.log(`Change kind: ${report.change_kind ?? "auto"}`);
  console.log(`Inspected files: ${report.inspected_paths.length}`);
  console.log(`Errors: ${report.summary.errors}`);
  console.log(`Warnings: ${report.summary.warnings}`);
  if (report.line_change_summary) {
    console.log(
      `Line changes: total +${report.line_change_summary.total.added} / -${report.line_change_summary.total.deleted} / net ${report.line_change_summary.total.net >= 0 ? "+" : ""}${report.line_change_summary.total.net}`
    );
    console.log(
      `Non-test line changes: +${report.line_change_summary.non_test.added} / -${report.line_change_summary.non_test.deleted} / net ${report.line_change_summary.non_test.net >= 0 ? "+" : ""}${report.line_change_summary.non_test.net}`
    );
  }

  if (report.findings.length === 0) {
    console.log("No maintainability findings.");
    return;
  }

  for (const item of report.findings) {
    const budgetText = item.budget == null ? "" : `, budget=${item.budget}`;
    const ruleText = item.rule_id ? `, rule=${item.rule_id}` : "";
    const symbolText = item.symbol_name ? `, symbol=${item.symbol_name}` : "";
    let locationText = "";
    if (item.line != null) {
      locationText = item.end_line != null && item.end_line !== item.line ? `, lines=${item.line}-${item.end_line}` : `, line=${item.line}`;
    }
    let metricText = "";
    if (item.metric_value != null) {
      const previousMetricText = item.previous_metric_value == null ? "n/a" : String(item.previous_metric_value);
      metricText = `, metric=${item.metric_value}, previous_metric=${previousMetricText}`;
    }
    const namingRoleText = item.naming_role ? `, naming_role=${item.naming_role}` : "";
    const matchedSignalsText = Array.isArray(item.matched_signals) && item.matched_signals.length > 0
      ? `, matched_signals=${item.matched_signals.join("|")}`
      : "";
    const countText = item.current_count == null
      ? ""
      : (() => {
          const previousCountText = item.previous_count == null ? "new" : String(item.previous_count);
          const deltaCountText = item.delta_count == null ? "n/a" : `${item.delta_count >= 0 ? "+" : ""}${item.delta_count}`;
          return `, count=${item.current_count}, previous_count=${previousCountText}, delta_count=${deltaCountText}`;
        })();
    const lineCountText = item.current_count == null
      ? (() => {
          const deltaText = item.delta_lines == null ? "n/a" : `${item.delta_lines >= 0 ? "+" : ""}${item.delta_lines}`;
          const previousText = item.previous_lines == null ? "new" : String(item.previous_lines);
          return `, current=${item.current_lines}, previous=${previousText}, delta=${deltaText}`;
        })()
      : "";
    const exceptionText = item.exception_path ? `, exception=${item.exception_path}` : "";
    console.log(
      `- [${item.level}] ${item.path} (source=${item.source}${lineCountText}${countText}${budgetText}${ruleText}${symbolText}${locationText}${metricText}${namingRoleText}${matchedSignalsText}${exceptionText})`
    );
    console.log(`  ${item.message}`);
    if (item.exception_reason) {
      console.log(`  exception reason: ${item.exception_reason}`);
    }
    console.log(`  seam: ${item.suggested_seam}`);
  }
}
