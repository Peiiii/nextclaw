export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripYamlFrontmatter(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.trim() !== "---") {
    return text;
  }
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  return closingIndex > 0 ? lines.slice(closingIndex + 1).join("\n").trim() : text;
}

function renderInlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function isMarkdownBlockStart(line: string): boolean {
  return /^(#{1,4})\s+/.test(line)
    || /^([-*])\s+/.test(line)
    || /^\d+\.\s+/.test(line)
    || /^>\s?/.test(line)
    || /^```/.test(line);
}

type MarkdownRenderResult = {
  html: string;
  nextIndex: number;
};

function renderCodeBlock(lines: string[], index: number, fenceMatch: RegExpMatchArray): MarkdownRenderResult {
  const codeLines: string[] = [];
  let nextIndex = index + 1;
  while (nextIndex < lines.length && !lines[nextIndex]?.trim().startsWith("```")) {
    codeLines.push(lines[nextIndex] ?? "");
    nextIndex += 1;
  }
  const language = fenceMatch[1] ? `<span class="code-language">${escapeHtml(fenceMatch[1])}</span>` : "";
  return {
    html: `<div class="code-block">${language}<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre></div>`,
    nextIndex: nextIndex + 1,
  };
}

function renderHeadingBlock(headingMatch: RegExpMatchArray, index: number): MarkdownRenderResult {
  const level = Math.min(4, headingMatch[1]?.length ?? 2);
  return {
    html: `<h${level}>${renderInlineMarkdown(headingMatch[2] ?? "")}</h${level}>`,
    nextIndex: index + 1,
  };
}

function renderListBlock(lines: string[], index: number, ordered: boolean): MarkdownRenderResult {
  const items: string[] = [];
  let nextIndex = index;
  const matcher = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
  while (nextIndex < lines.length && matcher.test(lines[nextIndex]?.trim() ?? "")) {
    items.push(`<li>${renderInlineMarkdown((lines[nextIndex] ?? "").trim().replace(matcher, ""))}</li>`);
    nextIndex += 1;
  }
  return {
    html: ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`,
    nextIndex,
  };
}

function renderQuoteBlock(lines: string[], index: number): MarkdownRenderResult {
  const quotes: string[] = [];
  let nextIndex = index;
  while (nextIndex < lines.length && /^>\s?/.test(lines[nextIndex]?.trim() ?? "")) {
    quotes.push((lines[nextIndex] ?? "").trim().replace(/^>\s?/, ""));
    nextIndex += 1;
  }
  return {
    html: `<blockquote>${renderInlineMarkdown(quotes.join(" "))}</blockquote>`,
    nextIndex,
  };
}

function renderParagraphBlock(lines: string[], index: number): MarkdownRenderResult {
  const paragraphLines: string[] = [];
  let nextIndex = index;
  while (nextIndex < lines.length) {
    const paragraphLine = lines[nextIndex]?.trim() ?? "";
    if (!paragraphLine || isMarkdownBlockStart(paragraphLine)) {
      break;
    }
    paragraphLines.push(paragraphLine);
    nextIndex += 1;
  }
  return {
    html: `<p>${renderInlineMarkdown(paragraphLines.join(" "))}</p>`,
    nextIndex,
  };
}

function renderMarkdownBlock(lines: string[], index: number): MarkdownRenderResult {
  const trimmed = lines[index]?.trim() ?? "";
  const fenceMatch = trimmed.match(/^```(\S*)/);
  if (fenceMatch) {
    return renderCodeBlock(lines, index, fenceMatch);
  }

  const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
  if (headingMatch) {
    return renderHeadingBlock(headingMatch, index);
  }

  if (/^[-*]\s+/.test(trimmed)) {
    return renderListBlock(lines, index, false);
  }
  if (/^\d+\.\s+/.test(trimmed)) {
    return renderListBlock(lines, index, true);
  }
  if (/^>\s?/.test(trimmed)) {
    return renderQuoteBlock(lines, index);
  }
  return renderParagraphBlock(lines, index);
}

export function renderDetailMarkdown(markdown: string): string {
  const lines = stripYamlFrontmatter(markdown).replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    if (!(lines[index] ?? "").trim()) {
      index += 1;
      continue;
    }

    const result = renderMarkdownBlock(lines, index);
    blocks.push(result.html);
    index = result.nextIndex;
  }

  return blocks.join("");
}

type MetadataEntry = {
  key: string;
  value: string;
};

function stringifyMetadataValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((entry) => stringifyMetadataValue(entry)).join(", ");
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value ?? "");
}

function readJsonMetadata(raw: string): MetadataEntry[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }
    return Object.entries(parsed)
      .map(([key, value]) => ({ key, value: stringifyMetadataValue(value) }))
      .filter((entry) => entry.value.trim().length > 0);
  } catch {
    return [];
  }
}

function readYamlLikeMetadata(raw: string): MetadataEntry[] {
  return raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.match(/^([A-Za-z0-9_.-]+):\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      key: match[1] ?? "",
      value: match[2]?.replace(/^["']|["']$/g, "") ?? "",
    }))
    .filter((entry) => entry.key && entry.value.trim().length > 0);
}

export function renderDetailMetadata(raw: string): string {
  const entries = readJsonMetadata(raw);
  const metadataEntries = entries.length > 0 ? entries : readYamlLikeMetadata(raw);
  if (metadataEntries.length === 0) {
    return `<pre class="code">${escapeHtml(raw)}</pre>`;
  }
  return `<dl class="metadata-list">${metadataEntries
    .map(
      (entry) => `<div><dt>${escapeHtml(entry.key)}</dt><dd>${escapeHtml(entry.value)}</dd></div>`,
    )
    .join("")}</dl>`;
}
