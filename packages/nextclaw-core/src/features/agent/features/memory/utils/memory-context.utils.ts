/** Shared memory sections; hosts provide text without choosing prompt policy. */
export function renderMemoryContext(input: { workspaceMemory: string; longTerm: string; today: string }): string {
  return [
    ["Workspace Memory", input.workspaceMemory],
    ["Long-term Memory", input.longTerm],
    ["Today's Notes", input.today],
  ].flatMap(([title, content]) => content ? [`## ${title}\n${content}`] : []).join("\n\n");
}
