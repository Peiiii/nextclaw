export type ToolCatalogEntry = {
  name: string;
  description?: string;
};

export const DEFAULT_TOOL_CATALOG: ReadonlyArray<ToolCatalogEntry> = [
  { name: "read_file", description: "Read file contents" },
  { name: "write_file", description: "Create or overwrite files" },
  { name: "edit_file", description: "Make precise edits to files" },
  { name: "list_dir", description: "List directory contents" },
  { name: "exec", description: "Run shell commands" },
  { name: "web_search", description: "Search the web" },
  { name: "web_fetch", description: "Fetch and extract readable content from a URL" },
  { name: "message", description: "Send messages and channel actions" },
  { name: "sessions_list", description: "List other sessions" },
  { name: "sessions_history", description: "Fetch history for another session/sub-agent" },
  { name: "spawn", description: "Create a sub-agent" },
  { name: "subagents", description: "List, steer, or kill sub-agent runs" },
  { name: "memory_search", description: "Search memory files" },
  { name: "memory_get", description: "Read memory file snippets" },
  { name: "cron", description: "Manage cron jobs and wake events" },
  { name: "gateway", description: "Restart/apply config/update running process" },
];

export function normalizeToolCatalogEntries(
  entries: ReadonlyArray<ToolCatalogEntry>,
): ToolCatalogEntry[] {
  const normalized: ToolCatalogEntry[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const name = entry.name.trim();
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    const description = entry.description?.trim();
    normalized.push({
      name,
      ...(description ? { description } : {}),
    });
  }
  return normalized;
}

export function buildToolCatalogEntries(
  entries: ReadonlyArray<{ name?: unknown; description?: unknown }>,
): ToolCatalogEntry[] {
  return normalizeToolCatalogEntries(
    entries.map((entry) => ({
      name: typeof entry.name === "string" ? entry.name : "",
      ...(typeof entry.description === "string" ? { description: entry.description } : {}),
    })),
  );
}

export function buildToolCatalogEntriesFromToolDefinitions(
  definitions: ReadonlyArray<Record<string, unknown>>,
): ToolCatalogEntry[] {
  return buildToolCatalogEntries(
    definitions.map((definition) => {
      const fn =
        definition.function && typeof definition.function === "object"
          ? (definition.function as { name?: unknown; description?: unknown })
          : {};
      return {
        name: fn.name,
        description: fn.description,
      };
    }),
  );
}
