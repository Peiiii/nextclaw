type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease: Array<number | string>;
};

export function satisfiesAppEngineVersion(version: string, range: string): boolean {
  const parsedVersion = parseVersion(version);
  const normalizedRange = range.trim();
  if (!parsedVersion || !normalizedRange) {
    return false;
  }
  return normalizedRange.split(/\s*\|\|\s*/).some((alternative) =>
    satisfiesAlternative(parsedVersion, alternative.trim())
  );
}

function satisfiesAlternative(version: ParsedVersion, range: string): boolean {
  const hyphenRange = /^(\S+)\s+-\s+(\S+)$/.exec(range);
  if (hyphenRange) {
    const lower = parseVersion(hyphenRange[1] ?? "");
    const upper = parseVersion(hyphenRange[2] ?? "");
    return Boolean(lower && upper && compareVersions(version, lower) >= 0 && compareVersions(version, upper) <= 0);
  }
  const comparators = range.split(/\s+/).filter(Boolean);
  return comparators.length > 0 && comparators.every((comparator) =>
    satisfiesComparator(version, comparator)
  );
}

function satisfiesComparator(version: ParsedVersion, comparator: string): boolean {
  if (comparator === "*" || comparator.toLowerCase() === "x") {
    return true;
  }
  if (comparator.startsWith("^")) {
    const lower = parseVersion(comparator.slice(1));
    if (!lower) return false;
    const upper = lower.major > 0
      ? { major: lower.major + 1, minor: 0, patch: 0, prerelease: [] }
      : lower.minor > 0
        ? { major: 0, minor: lower.minor + 1, patch: 0, prerelease: [] }
        : { major: 0, minor: 0, patch: lower.patch + 1, prerelease: [] };
    return compareVersions(version, lower) >= 0 && compareVersions(version, upper) < 0;
  }
  if (comparator.startsWith("~")) {
    const lower = parseVersion(comparator.slice(1));
    if (!lower) return false;
    const upper = { major: lower.major, minor: lower.minor + 1, patch: 0, prerelease: [] };
    return compareVersions(version, lower) >= 0 && compareVersions(version, upper) < 0;
  }
  if (/[xX*]/.test(comparator)) {
    const parts = comparator.replace(/^v/, "").split(".");
    const expected = [version.major, version.minor, version.patch];
    return parts.every((part, index) =>
      /^(x|\*)$/i.test(part) || Number(part) === expected[index]
    );
  }
  const match = /^(>=|<=|>|<|=)?\s*(.+)$/.exec(comparator);
  const target = parseVersion(match?.[2] ?? "");
  if (!target) return false;
  const compared = compareVersions(version, target);
  switch (match?.[1] ?? "=") {
    case ">=": return compared >= 0;
    case "<=": return compared <= 0;
    case ">": return compared > 0;
    case "<": return compared < 0;
    default: return compared === 0;
  }
}

function parseVersion(raw: string): ParsedVersion | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(raw.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]
      ? match[4].split(".").map((part) => /^\d+$/.test(part) ? Number(part) : part)
      : [],
  };
}

function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  for (const field of ["major", "minor", "patch"] as const) {
    if (left[field] !== right[field]) {
      return left[field] > right[field] ? 1 : -1;
    }
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    return Number(left.prerelease.length === 0) - Number(right.prerelease.length === 0);
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined || rightPart === undefined) {
      return leftPart === undefined ? -1 : 1;
    }
    if (leftPart === rightPart) continue;
    if (typeof leftPart === "number" && typeof rightPart === "number") {
      return leftPart > rightPart ? 1 : -1;
    }
    if (typeof leftPart === "number") return -1;
    if (typeof rightPart === "number") return 1;
    return leftPart.localeCompare(rightPart);
  }
  return 0;
}
