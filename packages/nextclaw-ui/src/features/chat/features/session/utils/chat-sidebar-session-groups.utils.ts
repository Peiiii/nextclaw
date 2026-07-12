import type { SessionEntryView } from "@/shared/lib/api";
import type { NcpSessionListItemView } from "@/features/chat/features/ncp/hooks/use-ncp-session-list-view";
import { getSessionProjectName } from "@/shared/lib/session-project";
import { t } from "@/shared/lib/i18n";

export type ChatSidebarDateGroup = {
  label: string;
  items: NcpSessionListItemView[];
};

export type ChatSidebarProjectGroup = {
  projectRoot: string;
  projectName: string;
  items: NcpSessionListItemView[];
  latestUpdatedAt: number;
  isPinned: boolean;
};

export function getSessionActivityAtTimestamp(
  item: NcpSessionListItemView,
): number {
  return new Date(
    item.session.lastMessageAt ?? item.session.createdAt,
  ).getTime();
}

export function sortSessionItemsByActivityAtDesc(
  items: NcpSessionListItemView[],
): NcpSessionListItemView[] {
  return [...items].sort(
    (left, right) =>
      getSessionActivityAtTimestamp(right) -
      getSessionActivityAtTimestamp(left),
  );
}

function sortSessionItemsByPinnedActivityAtDesc(
  items: NcpSessionListItemView[],
  pinnedSessionKeys: ReadonlySet<string>,
): NcpSessionListItemView[] {
  return [...items].sort((left, right) => {
    const pinnedDifference = Number(pinnedSessionKeys.has(right.session.key)) - Number(pinnedSessionKeys.has(left.session.key));
    return pinnedDifference || getSessionActivityAtTimestamp(right) - getSessionActivityAtTimestamp(left);
  });
}

export function groupSessionsByDate(
  items: NcpSessionListItemView[],
  pinnedSessionKeys: ReadonlySet<string> = new Set(),
): ChatSidebarDateGroup[] {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const yesterdayStart = todayStart - 86_400_000;
  const sevenDaysStart = todayStart - 7 * 86_400_000;

  const today: NcpSessionListItemView[] = [];
  const yesterday: NcpSessionListItemView[] = [];
  const previous7: NcpSessionListItemView[] = [];
  const older: NcpSessionListItemView[] = [];

  const unpinnedItems = items.filter((item) => !pinnedSessionKeys.has(item.session.key));
  const pinnedItems = sortSessionItemsByPinnedActivityAtDesc(
    items.filter((item) => pinnedSessionKeys.has(item.session.key)),
    pinnedSessionKeys,
  );

  for (const item of unpinnedItems) {
    const ts = getSessionActivityAtTimestamp(item);
    if (ts >= todayStart) {
      today.push(item);
    } else if (ts >= yesterdayStart) {
      yesterday.push(item);
    } else if (ts >= sevenDaysStart) {
      previous7.push(item);
    } else {
      older.push(item);
    }
  }

  const groups: ChatSidebarDateGroup[] = [];
  if (pinnedItems.length > 0) groups.push({ label: t("chatSidebarPinned"), items: pinnedItems });
  if (today.length > 0) groups.push({ label: t("chatSidebarToday"), items: today });
  if (yesterday.length > 0)
    groups.push({ label: t("chatSidebarYesterday"), items: yesterday });
  if (previous7.length > 0)
    groups.push({ label: t("chatSidebarPrevious7Days"), items: previous7 });
  if (older.length > 0) groups.push({ label: t("chatSidebarOlder"), items: older });
  return groups;
}

export function groupSessionsByProject(
  items: NcpSessionListItemView[],
  pinnedSessionKeys: ReadonlySet<string> = new Set(),
  pinnedProjectRoots: ReadonlySet<string> = new Set(),
): ChatSidebarProjectGroup[] {
  const grouped = new Map<string, ChatSidebarProjectGroup>();

  for (const item of items) {
    const projectRoot = item.session.projectRoot?.trim();
    if (!projectRoot) {
      continue;
    }
    const existingGroup = grouped.get(projectRoot);
    const updatedAt = getSessionActivityAtTimestamp(item);
    if (existingGroup) {
      existingGroup.items.push(item);
      existingGroup.latestUpdatedAt = Math.max(
        existingGroup.latestUpdatedAt,
        updatedAt,
      );
      continue;
    }
    grouped.set(projectRoot, {
      projectRoot,
      projectName:
        item.session.projectName?.trim() ||
        getSessionProjectName(projectRoot) ||
        projectRoot,
      items: [item],
      latestUpdatedAt: updatedAt,
      isPinned: pinnedProjectRoots.has(projectRoot),
    });
  }

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      items: sortSessionItemsByPinnedActivityAtDesc(group.items, pinnedSessionKeys),
    }))
    .sort((left, right) => Number(right.isPinned) - Number(left.isPinned) || right.latestUpdatedAt - left.latestUpdatedAt);
}

export function groupChildSessionsByParentKey(
  items: NcpSessionListItemView[],
): Map<string, NcpSessionListItemView[]> {
  const grouped = new Map<string, NcpSessionListItemView[]>();
  for (const item of items) {
    const parentSessionKey = item.session.parentSessionId?.trim();
    if (!parentSessionKey) {
      continue;
    }
    const bucket = grouped.get(parentSessionKey) ?? [];
    bucket.push(item);
    grouped.set(parentSessionKey, bucket);
  }
  for (const bucket of grouped.values()) {
    bucket.sort(
      (left, right) =>
        getSessionActivityAtTimestamp(right) -
        getSessionActivityAtTimestamp(left),
    );
  }
  return grouped;
}

export function getSessionTitle(session: SessionEntryView): string {
  if (session.label && session.label.trim()) {
    return session.label.trim();
  }
  const chunks = session.key.split(":");
  return chunks[chunks.length - 1] || session.key;
}
