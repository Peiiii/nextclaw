export type HermesInlineToolTrace = {
  toolName: string;
  args: string;
};

const HERMES_INLINE_TOOL_TRACE_PATTERNS: Array<{
  icon: string;
  toolName: string;
  buildArgs: (rawArgs: string) => string;
}> = [
  {
    icon: "🔎",
    toolName: "search_files",
    buildArgs: (rawArgs) => JSON.stringify({ pattern: rawArgs }),
  },
  {
    icon: "💻",
    toolName: "terminal",
    buildArgs: (rawArgs) => JSON.stringify({ command: rawArgs }),
  },
];

export function matchHermesInlineToolTrace(segment: string): HermesInlineToolTrace | null {
  const trimmed = segment.trim();
  if (!trimmed.startsWith("`") || !trimmed.endsWith("`")) {
    return null;
  }

  const body = trimmed.slice(1, -1).trim();
  for (const candidate of HERMES_INLINE_TOOL_TRACE_PATTERNS) {
    if (!body.startsWith(candidate.icon)) {
      continue;
    }
    const rawArgs = body.slice(candidate.icon.length).trim();
    if (!rawArgs) {
      return null;
    }
    return {
      toolName: candidate.toolName,
      args: candidate.buildArgs(rawArgs),
    };
  }

  return null;
}
