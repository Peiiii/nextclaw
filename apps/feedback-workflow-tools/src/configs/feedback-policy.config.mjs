export const feedbackPolicy = Object.freeze({
  // Maintenance application defaults; deployment configuration may narrow the scope.
  allowedPaths: [],
  allowRelease: false
});
export function validateFeedbackPaths(paths, allowedPaths) {
  if (!Array.isArray(paths) || !paths.length || !Array.isArray(allowedPaths) || !allowedPaths.length || [...paths, ...allowedPaths].some((path) => typeof path !== "string")) throw new Error("No authorized repair paths.");
  const forbidden = /(^|\/)(\.git|\.github|\.agents|\.codex|node_modules)(\/|$)|(^|\/)(AGENTS|CLAUDE)\.md$|(^|\/)(package\.json|pnpm-lock\.yaml)$|^scripts\/(release|feedback)\//;
  for (const path of paths) {
    if (path.includes("..") || path.startsWith("/") || forbidden.test(path) ||
      !allowedPaths.some((prefix) => path === prefix || (prefix.endsWith("/") && path.startsWith(prefix)))) {
      throw new Error("Repair exceeds authorized scope: " + path);
    }
  }
}
