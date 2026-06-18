const INPUT_SURFACE_MATCH_SCORE = {
  exactId: 1200,
  exactLabel: 1150,
  prefixId: 1000,
  prefixLabel: 950,
  prefixToken: 900,
  containsId: 800,
  containsLabel: 760,
  containsDescription: 500,
  subsequence: 300,
  fallback: 1,
} as const;

export type InputSurfaceSearchCandidate = {
  id: string;
  label: string;
  description?: string;
  aliases?: readonly string[];
};

export function normalizeInputSurfaceSearchText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function buildInputSurfaceRecentOrderIndex(values: readonly string[]): Map<string, number> {
  return new Map(values.map((value, index) => [value, index] as const));
}

function isSubsequenceMatch(query: string, target: string): boolean {
  if (!query || !target) {
    return false;
  }
  let pointer = 0;
  for (const char of target) {
    if (char === query[pointer]) {
      pointer += 1;
      if (pointer >= query.length) {
        return true;
      }
    }
  }
  return false;
}

export function scoreInputSurfaceSearchCandidate(
  candidate: InputSurfaceSearchCandidate,
  query: string,
): number {
  const normalizedQuery = normalizeInputSurfaceSearchText(query);
  if (!normalizedQuery) {
    return INPUT_SURFACE_MATCH_SCORE.fallback;
  }

  const id = normalizeInputSurfaceSearchText(candidate.id);
  const label = normalizeInputSurfaceSearchText(candidate.label || candidate.id);
  const description = normalizeInputSurfaceSearchText(candidate.description);
  const aliases = (candidate.aliases ?? []).map(normalizeInputSurfaceSearchText).filter(Boolean);
  const labelTokens = label.split(/[\s/_-]+/).filter(Boolean);
  const idCandidates = [id, ...aliases];

  if (idCandidates.some((value) => value === normalizedQuery)) {
    return INPUT_SURFACE_MATCH_SCORE.exactId;
  }
  if (label === normalizedQuery) {
    return INPUT_SURFACE_MATCH_SCORE.exactLabel;
  }
  if (idCandidates.some((value) => value.startsWith(normalizedQuery))) {
    return INPUT_SURFACE_MATCH_SCORE.prefixId;
  }
  if (label.startsWith(normalizedQuery)) {
    return INPUT_SURFACE_MATCH_SCORE.prefixLabel;
  }
  if (labelTokens.some((token) => token.startsWith(normalizedQuery))) {
    return INPUT_SURFACE_MATCH_SCORE.prefixToken;
  }
  if (idCandidates.some((value) => value.includes(normalizedQuery))) {
    return INPUT_SURFACE_MATCH_SCORE.containsId;
  }
  if (label.includes(normalizedQuery)) {
    return INPUT_SURFACE_MATCH_SCORE.containsLabel;
  }
  if (description.includes(normalizedQuery)) {
    return INPUT_SURFACE_MATCH_SCORE.containsDescription;
  }
  if (
    isSubsequenceMatch(normalizedQuery, label) ||
    idCandidates.some((value) => isSubsequenceMatch(normalizedQuery, value))
  ) {
    return INPUT_SURFACE_MATCH_SCORE.subsequence;
  }
  return 0;
}

export function resolveInputSurfaceMatchTier(score: number): number {
  if (score >= INPUT_SURFACE_MATCH_SCORE.exactLabel) {
    return 4;
  }
  if (score >= INPUT_SURFACE_MATCH_SCORE.prefixToken) {
    return 3;
  }
  if (score >= INPUT_SURFACE_MATCH_SCORE.containsLabel) {
    return 2;
  }
  if (score > 0) {
    return 1;
  }
  return 0;
}
