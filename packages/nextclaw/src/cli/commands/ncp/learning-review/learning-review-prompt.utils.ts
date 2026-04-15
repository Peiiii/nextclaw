function pluralizeToolCalls(value: number): string {
  return value === 1 ? "1 tool call" : `${value} tool calls`;
}

export function buildLearningReviewTask(params: {
  sessionId: string;
  toolCallsSinceReview: number;
  currentToolCallCount: number;
}): string {
  return [
    "Run a background learning review for the parent session.",
    `Parent session id: ${params.sessionId}.`,
    `There have been ${pluralizeToolCalls(params.toolCallsSinceReview)} since the last learning review (${params.currentToolCallCount} total so far).`,
    "",
    "Your job is to extract only the reusable lesson.",
    "- Review the parent session history and, if helpful, use session_search to compare similar historical sessions.",
    "- Decide exactly one outcome: no_skill_change, patch_existing_skill, or create_new_skill.",
    "- Prefer patching an existing skill when the lesson extends an existing workflow.",
    "- Only create a new skill when the lesson is clearly reusable, repeatable, and likely to recur.",
    "- Do not create or patch a skill for one-off quirks, noisy transcripts, or narrow local accidents.",
    "",
    "If you decide to patch or create a skill:",
    "- Use the available file tools.",
    "- Keep the change minimal and maintainable.",
    "- Write the skill into the current workspace/project skills directory under skills/<slug>/SKILL.md.",
    "- Follow the built-in skill-creator guidance when it helps.",
    "",
    "If nothing reusable should be saved, stop without writing files.",
  ].join("\n");
}
