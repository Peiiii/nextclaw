import type { FileDraft } from "@/features/space/types/bibo-space.types";

const key = (accountId: string) => `bibo-file-drafts:${accountId}`;

export function readFileDrafts(accountId: string): Record<string, FileDraft> {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(key(accountId)) ?? "{}");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).flatMap(([id, value]) => {
      if (!value || typeof value.content !== "string" || !Number.isSafeInteger(value.version) || value.version < 1) return [];
      return [[id, { content: value.content, version: value.version, dirty: true, saving: false }]];
    }));
  } catch { return {}; }
}

export function writeFileDrafts(accountId: string, drafts: Record<string, FileDraft>): boolean {
  try {
    const dirty = Object.fromEntries(Object.entries(drafts).filter(([, draft]) => draft.dirty).map(([id, draft]) => [id, { content: draft.content, version: draft.version }]));
    if (Object.keys(dirty).length) sessionStorage.setItem(key(accountId), JSON.stringify(dirty));
    else sessionStorage.removeItem(key(accountId));
    return true;
  } catch { return false; }
}
