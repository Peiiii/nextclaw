export type DesktopPublishTarget = {
  owner: string;
  repo: string;
};

export function resolveDesktopGitHubPublishTarget(packageJson: {
  build?: { publish?: unknown };
}): DesktopPublishTarget | null {
  const publishTargets = Array.isArray(packageJson.build?.publish) ? packageJson.build.publish : [];
  const githubTarget = publishTargets.find((entry) => {
    const provider = (entry as { provider?: unknown }).provider;
    return provider === "github";
  }) as { owner?: unknown; repo?: unknown } | undefined;
  const owner = typeof githubTarget?.owner === "string" ? githubTarget.owner.trim() : "";
  const repo = typeof githubTarget?.repo === "string" ? githubTarget.repo.trim() : "";
  if (!owner || !repo) {
    return null;
  }
  return { owner, repo };
}
