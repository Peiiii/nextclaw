import { ViewMemoryStorage } from "@/shared/lib/navigation-history";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PageResource } from "@/features/right-panel-resources/types/page-resource.types";

function safeTargetUrl(value: string): boolean {
  if (/^\/(?!\/)/.test(value) && !value.includes("\\")) return true;
  try {
    return ["nextclaw:", "http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function readPages(value: unknown): PageResource[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("pinned" in value) ||
    !Array.isArray(value.pinned)
  )
    return [];
  return value.pinned
    .filter((page): page is PageResource => {
      if (!page || typeof page !== "object") return false;
      return (
        typeof page.uri === "string" &&
        /^(nextclaw:\/\/|https?:\/\/)/.test(page.uri) &&
        typeof page.title === "string" &&
        typeof page.target?.url === "string" &&
        safeTargetUrl(page.target.url) &&
        (page.mainPath === undefined ||
          (typeof page.mainPath === "string" &&
            /^\/(?!\/)/.test(page.mainPath) &&
            !page.mainPath.includes("\\"))) &&
        typeof page.target?.kind === "string" &&
        typeof page.target?.title === "string" &&
        ["managed", "none"].includes(page.target.historyPolicy)
      );
    })
    .filter(
      (page, index, pages) =>
        pages.findIndex((candidate) => candidate.uri === page.uri) === index,
    )
    .slice(-64);
}

export const usePageNavigationStore = create<{ pinned: PageResource[] }>()(
  persist((): { pinned: PageResource[] } => ({ pinned: [] }), {
    name: "nextclaw.page-navigation",
    version: 1,
    storage: createJSONStorage(() => new ViewMemoryStorage()),
    merge: (saved, current) => ({ ...current, pinned: readPages(saved) }),
  }),
);
