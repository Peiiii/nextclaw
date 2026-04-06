import { ESLint } from "eslint";

import { FUNCTION_RULE_IDS, ROOT } from "./maintainability-guard-support.mjs";

const SYMBOL_NAME_PATTERN = /(?:Async method|Method|Function) '([^']+)'/;
const PARENTHESIZED_NUMBER_PATTERN = /\((\d+)\)/;
const COGNITIVE_COMPLEXITY_PATTERN = /from (\d+)/;
const eslint = new ESLint({
  cwd: ROOT,
  errorOnUnmatchedPattern: false
});

function parseMetricValue(ruleId, message) {
  if (ruleId === "sonarjs/cognitive-complexity") {
    const match = message.match(COGNITIVE_COMPLEXITY_PATTERN);
    return match ? Number(match[1]) : null;
  }
  const match = message.match(PARENTHESIZED_NUMBER_PATTERN);
  return match ? Number(match[1]) : null;
}

function parseSymbolName(message) {
  const match = message.match(SYMBOL_NAME_PATTERN);
  return match ? match[1] : null;
}

export async function lintContent(pathText, content) {
  const payload = await eslint.lintText(content, { filePath: pathText });
  if (!Array.isArray(payload) || payload.length === 0) {
    return [];
  }

  return (payload[0].messages || [])
    .filter((message) => FUNCTION_RULE_IDS.has(message.ruleId))
    .map((message) => ({
      ruleId: message.ruleId,
      message: message.message || "",
      line: Number(message.line || 0),
      endLine: Number(message.endLine || message.line || 0),
      nodeType: message.nodeType || null,
      symbolName: parseSymbolName(message.message || ""),
      metricValue: parseMetricValue(message.ruleId, message.message || "")
    }));
}

export function buildSignature(finding) {
  if (!finding.symbolName) {
    return null;
  }
  return `${finding.ruleId}::${finding.symbolName}`;
}
