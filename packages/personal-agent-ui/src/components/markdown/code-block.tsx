import { useEffect, useMemo, useState } from "react";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import { Button } from "../button";
import { MarkdownMermaidDiagram } from "./mermaid-diagram";
import type { MarkdownLabels } from "./markdown";

const languages = {
  bash: { grammar: bash, aliases: ["sh", "zsh"] },
  css: { grammar: css, aliases: [] },
  diff: { grammar: diff, aliases: ["patch"] },
  javascript: { grammar: javascript, aliases: ["js", "jsx", "mjs"] },
  json: { grammar: json, aliases: ["jsonc"] },
  markdown: { grammar: markdown, aliases: ["md"] },
  python: { grammar: python, aliases: ["py"] },
  sql: { grammar: sql, aliases: [] },
  typescript: { grammar: typescript, aliases: ["ts", "tsx"] },
  xml: { grammar: xml, aliases: ["html", "svg"] },
  yaml: { grammar: yaml, aliases: ["yml"] },
};

const highlighter = hljs.newInstance();
for (const [name, { grammar, aliases }] of Object.entries(languages)) {
  highlighter.registerLanguage(name, grammar);
  if (aliases.length) highlighter.registerAliases(aliases, { languageName: name });
}

export function MarkdownCodeBlock({ code, language = "text", labels }: { code: string; language?: string; labels: MarkdownLabels }) {
  const [feedback, setFeedback] = useState<"ready" | "copied" | "failed">("ready");
  const [showSource, setShowSource] = useState(false);
  const normalizedLanguage = language.trim().toLowerCase().slice(0, 32) || "text";
  const diagram = normalizedLanguage === "mermaid";
  const highlighted = useMemo(() => {
    if (code.length > 50_000 || !highlighter.getLanguage(normalizedLanguage)) return null;
    try {
      return highlighter.highlight(code, { language: normalizedLanguage, ignoreIllegals: true }).value;
    } catch {
      return null;
    }
  }, [code, normalizedLanguage]);

  useEffect(() => {
    if (feedback === "ready") return;
    const timer = window.setTimeout(() => setFeedback("ready"), 2000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setFeedback("copied");
    } catch {
      setFeedback("failed");
    }
  };

  return <div className="ui-code-block">
    <div className="ui-code-block__toolbar">
      <span className="ui-code-block__language">{normalizedLanguage}</span>
      <div className="ui-code-block__actions">
        {diagram && <Button tone="text" aria-pressed={showSource} onClick={() => setShowSource(!showSource)}>{showSource ? labels.viewDiagram : labels.viewSource}</Button>}
        <Button tone="text" onClick={() => void copy()} aria-label={feedback === "copied" ? labels.copiedCode : feedback === "failed" ? labels.copyFailed : labels.copyCode}>
          {feedback === "copied" ? labels.copiedCode : feedback === "failed" ? labels.copyFailed : labels.copyCode}
        </Button>
      </div>
    </div>
    {diagram && !showSource
      ? <MarkdownMermaidDiagram source={code} labels={labels} />
      : <pre><code className={highlighted ? "hljs" : undefined} {...(highlighted ? { dangerouslySetInnerHTML: { __html: highlighted } } : { children: code })} /></pre>}
  </div>;
}
