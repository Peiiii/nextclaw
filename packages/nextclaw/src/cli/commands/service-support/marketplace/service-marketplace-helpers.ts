const containsAbsoluteFsPath = (line: string): boolean => {
  const normalized = line.trim();
  if (!normalized) {
    return false;
  }

  const lowered = normalized.toLowerCase();
  if (lowered.includes("http://") || lowered.includes("https://")) {
    return false;
  }

  if (/^[A-Za-z]:\\/.test(normalized)) {
    return true;
  }

  return /(?:^|\s)(?:~\/|\/[^\s]+)/.test(normalized);
};

export const pickUserFacingCommandSummary = (output: string, fallback: string): string => {
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return fallback;
  }

  const visibleLines = lines.filter((line) => {
    if (/^(path|install path|source path|destination|location)\s*:/i.test(line)) {
      return false;
    }
    if (containsAbsoluteFsPath(line)) {
      return false;
    }
    return true;
  });

  if (visibleLines.length === 0) {
    return fallback;
  }

  const preferred = [...visibleLines].reverse().find((line) =>
    /\b(installed|enabled|disabled|uninstalled|published|updated|already installed|removed)\b/i.test(line),
  );

  return preferred ?? visibleLines[visibleLines.length - 1] ?? fallback;
};

export const buildMarketplaceSkillInstallArgs = (params: {
  slug: string;
  workspace: string;
  force?: boolean;
}): string[] => {
  const args = ["skills", "install", params.slug, "--workdir", params.workspace];
  if (params.force) {
    args.push("--force");
  }
  return args;
};
