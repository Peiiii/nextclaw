/** Hide only an identical leading heading in the reading copy; stored content stays intact. */
export function inboxReadingBody(body: string, title: string): string {
  const heading = /^(?:[\t ]*\r?\n)* {0,3}#{1,2}[\t ]+([^\r\n]*)(?:\r?\n|$)/.exec(body);
  if (!heading) return body;
  const text = heading[1]!.replace(/[\t ]+#+[\t ]*$/, "").trim();
  return text === title.trim() ? body.slice(heading[0].length) : body;
}

export function inboxExcerpt(body: string): string {
  const lines = body.split(/\r?\n/).map((line) => line.trim());
  const line = lines.find((value) => value && !/^(?:#{1,6}\s|[-*+]\s|\d+\.\s|>|\||`{3}|~{3}|-{3,})/.test(value))
    ?? lines.find(Boolean) ?? "";
  return line
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|~~|`)(.*?)\1/g, "$2")
    .replace(/(^|[\s、，。])\*([^*]+)\*(?=\s|[.,，。、]|$)/g, "$1$2")
    .slice(0, 85);
}
