function parseStableVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? "");
  if (!match) {
    throw new Error(
      `Expected a stable semantic version, received ${version ?? "<missing>"}.`,
    );
  }
  return match.slice(1).map(Number);
}

export function resolveStableReleaseLevel(previousVersion, targetVersion) {
  const [previousMajor, previousMinor] = parseStableVersion(previousVersion);
  const [targetMajor, targetMinor] = parseStableVersion(targetVersion);
  if (targetMajor > previousMajor) {
    return "major";
  }
  if (targetMajor === previousMajor && targetMinor > previousMinor) {
    return "minor";
  }
  return "patch";
}

function collectSocialPostReviewIssues({
  pathExists,
  releaseLevel,
  socialPost,
}) {
  const issues = [];
  const allowedDecisions =
    releaseLevel === "minor" ? ["publish"] : ["publish", "not-needed"];
  if (!socialPost || !allowedDecisions.includes(socialPost.decision)) {
    issues.push(
      `social post decision must be ${allowedDecisions.join(" or ")}`,
    );
    return issues;
  }
  if (socialPost.decision === "not-needed") {
    if (typeof socialPost.reason !== "string" || !socialPost.reason.trim()) {
      issues.push("social post not-needed decision requires a reason");
    }
    return issues;
  }
  for (const field of [
    "account",
    "text",
    "imagePath",
    "imageAlt",
    "releaseNotesUrl",
  ]) {
    if (typeof socialPost[field] !== "string" || !socialPost[field].trim()) {
      issues.push(`social post ${field} is required`);
    }
  }
  if (socialPost.channel !== "x") issues.push("social post channel must be x");
  if (socialPost.account && !/^@[A-Za-z0-9_]{1,15}$/.test(socialPost.account)) {
    issues.push("social post account must be an X handle");
  }
  if (socialPost.text?.length > 280)
    issues.push("social post text must be at most 280 characters");
  if (
    socialPost.releaseNotesUrl &&
    !socialPost.text?.includes(socialPost.releaseNotesUrl)
  ) {
    issues.push("social post text must include releaseNotesUrl");
  }
  if (socialPost.imagePath && !pathExists(socialPost.imagePath)) {
    issues.push(
      `social post imagePath does not exist: ${socialPost.imagePath}`,
    );
  }
  return issues;
}

function collectReleaseIdentityIssues({ releaseLevel, review, targetVersion }) {
  const issues = [];
  if (review.version !== targetVersion) {
    issues.push(`review version must be ${targetVersion}`);
  }
  if (review.releaseType !== releaseLevel) {
    issues.push(`review releaseType must be ${releaseLevel}`);
  }
  return issues;
}

export function inspectStableSurfaceReview({
  pathExists,
  previousVersion,
  review,
  targetVersion,
}) {
  const releaseLevel = resolveStableReleaseLevel(
    previousVersion,
    targetVersion,
  );
  const required = releaseLevel === "major" || releaseLevel === "minor";
  if (!required) {
    return { issues: [], ready: true, releaseLevel, required };
  }

  const issues = [];
  if (!review || typeof review !== "object") {
    issues.push("release review is missing");
    return { issues, ready: false, releaseLevel, required };
  }
  issues.push(
    ...collectReleaseIdentityIssues({ releaseLevel, review, targetVersion }),
  );

  for (const [surfaceKey, label] of [
    ["docsSite", "docs site"],
    ["website", "website"],
  ]) {
    const surface = review.surfaces?.[surfaceKey];
    if (!surface || !["updated", "not-needed"].includes(surface.decision)) {
      issues.push(`${label} decision must be updated or not-needed`);
      continue;
    }
    if (surface.decision === "not-needed") {
      if (typeof surface.reason !== "string" || !surface.reason.trim()) {
        issues.push(`${label} not-needed decision requires a reason`);
      }
      continue;
    }
    const paths = Array.isArray(surface.paths) ? surface.paths : [];
    if (paths.length === 0) {
      issues.push(`${label} updated decision requires at least one path`);
      continue;
    }
    for (const path of paths) {
      if (
        typeof path !== "string" ||
        !path.trim() ||
        path.startsWith("/") ||
        path.includes("..")
      ) {
        issues.push(`${label} contains an invalid repository-relative path`);
      } else if (!pathExists(path)) {
        issues.push(`${label} path does not exist: ${path}`);
      }
    }
  }

  issues.push(
    ...collectSocialPostReviewIssues({
      pathExists,
      releaseLevel,
      socialPost: review.surfaces?.socialPost,
    }),
  );

  return { issues, ready: issues.length === 0, releaseLevel, required };
}
