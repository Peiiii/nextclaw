export const DEFAULT_ACCOUNT_ID = "default";

export function normalizeAccountId(accountId?: string | null): string {
  const trimmed = accountId?.trim();
  return trimmed || DEFAULT_ACCOUNT_ID;
}

export function normalizeOptionalAccountId(accountId?: string | null): string | undefined {
  const trimmed = accountId?.trim();
  return trimmed ? normalizeAccountId(trimmed) : undefined;
}

const VALID_AGENT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const INVALID_AGENT_CHARS_RE = /[^a-z0-9_-]+/g;

export function normalizeAgentId(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "main";
  }
  if (VALID_AGENT_ID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const normalized = trimmed
    .toLowerCase()
    .replace(INVALID_AGENT_CHARS_RE, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 64);
  return normalized || "main";
}
