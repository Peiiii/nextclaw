const ALWAYS_SKIPPED_COMPACTED_BOOTSTRAP_FILES = new Set([
  "BOOT.MD",
  "BOOTSTRAP.MD",
]);

function normalizeBootstrapFilename(filename: string): string {
  return filename.trim().toUpperCase();
}

export function shouldSkipCompactedSessionBootstrapFile(
  filename: string,
  content: string,
): boolean {
  const normalized = normalizeBootstrapFilename(filename);
  if (ALWAYS_SKIPPED_COMPACTED_BOOTSTRAP_FILES.has(normalized)) {
    return true;
  }
  if (normalized === "IDENTITY.MD") {
    return /Fill this in during your first conversation/i.test(content);
  }
  if (normalized === "USER.MD") {
    return /Learn about the person you are helping/i.test(content);
  }
  return false;
}

export function stripCompactedSessionOnboardingSections(block: string): string {
  const lines = block.split("\n");
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (!heading) {
      output.push(line);
      index += 1;
      continue;
    }

    const sectionLines = [line];
    index += 1;
    while (index < lines.length && !/^##\s+/.test(lines[index] ?? "")) {
      sectionLines.push(lines[index] ?? "");
      index += 1;
    }
    if (shouldSkipCompactedSessionBootstrapFile(heading[1] ?? "", sectionLines.join("\n"))) {
      continue;
    }
    output.push(...sectionLines);
  }

  return output.join("\n").trim();
}
