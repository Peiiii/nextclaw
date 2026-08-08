export const WORKSPACE_TEXT_EXCERPT_MAX_CHARACTERS = 8_000;

export type WorkspaceTextExcerpt = {
  path: string;
  label: string;
  excerpt: string;
  startLine: number | null;
  endLine: number | null;
};

function countLineBreaks(value: string): number {
  return value.match(/\n/g)?.length ?? 0;
}

export function buildWorkspaceTextExcerpt(params: {
  path: string;
  label: string;
  selectedText: string;
  sourceText: string;
  sourceStartLine?: number | null;
}): WorkspaceTextExcerpt | null {
  const {
    label: rawLabel,
    path: rawPath,
    selectedText,
    sourceStartLine = 1,
    sourceText,
  } = params;
  const path = rawPath.trim();
  const label = rawLabel.trim();
  const excerpt = selectedText.trim();
  if (!path || !label || !excerpt) {
    return null;
  }

  const sourceIndex = sourceText.indexOf(excerpt);
  const hasUniqueSourceMatch = sourceIndex >= 0 && sourceIndex === sourceText.lastIndexOf(excerpt);
  const baseLine = sourceStartLine ?? 1;
  const startLine = hasUniqueSourceMatch
    ? baseLine + countLineBreaks(sourceText.slice(0, sourceIndex))
    : null;
  const endLine = startLine === null
    ? null
    : startLine + countLineBreaks(excerpt);

  return {
    path,
    label,
    excerpt,
    startLine,
    endLine,
  };
}
