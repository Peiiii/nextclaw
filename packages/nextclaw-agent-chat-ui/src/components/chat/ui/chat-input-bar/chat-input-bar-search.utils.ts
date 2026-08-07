function isSubsequence(query: string, target: string): boolean {
  let queryIndex = 0;
  for (const character of target) {
    if (character === query[queryIndex]) {
      queryIndex += 1;
      if (queryIndex === query.length) {
        return true;
      }
    }
  }
  return query.length === 0;
}

export function matchesChatInputBarSearch(
  values: Array<string | undefined>,
  query: string,
): boolean {
  const searchable = values.filter(Boolean).join(" ").toLowerCase();
  const compactSearchable = searchable.replace(/[\s/_.-]+/g, "");
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => {
      const compactTerm = term.replace(/[\s/_.-]+/g, "");
      return (
        searchable.includes(term) ||
        isSubsequence(compactTerm, compactSearchable)
      );
    });
}
