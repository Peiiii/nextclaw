import { useEffect, useLayoutEffect, useRef, type MouseEventHandler, type ReactNode } from 'react';
import type { QueryKey } from '@tanstack/react-query';
import {
  normalizeWorkspaceProjectTreeRootKey,
  useWorkspaceProjectTreeStore,
} from '@/features/chat/features/workspace/stores/workspace-project-tree.store';
import { t } from '@/shared/lib/i18n';

function normalizeComparablePath(path: string): string {
  const normalized = path.trim().replace(/\\/g, '/').replace(/\/+$/g, '') || '/';
  return /^[a-z]:/i.test(normalized) ? normalized.toLowerCase() : normalized;
}

export function isWorkspaceProjectBrowseQuery(queryKey: QueryKey, rootPath: string): boolean {
  if (queryKey[0] !== 'server-path-browse' || queryKey[3] !== true || typeof queryKey[1] !== 'string') {
    return false;
  }
  const root = normalizeComparablePath(rootPath);
  const candidate = normalizeComparablePath(queryKey[1]);
  return candidate === root || (root === '/' ? candidate.startsWith('/') : candidate.startsWith(`${root}/`));
}

export function WorkspaceProjectTree({
  children,
  currentPath,
  onBlankContext,
  onContextMenu,
  rootDraft,
  showRoot,
}: {
  children: ReactNode;
  currentPath: string | null;
  onBlankContext: () => void;
  onContextMenu?: MouseEventHandler<HTMLDivElement>;
  rootDraft: ReactNode;
  showRoot: boolean;
}) {
  const treeRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollTopRef = useRef<number | null>(null);
  const scrollPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const treeRootKey = normalizeWorkspaceProjectTreeRootKey(currentPath);
  const savedScrollTop = useWorkspaceProjectTreeStore((state) =>
    treeRootKey ? (state.trees[treeRootKey]?.scrollTop ?? 0) : 0,
  );
  const setScrollTop = useWorkspaceProjectTreeStore((state) => state.setScrollTop);

  useLayoutEffect(() => {
    if (treeRef.current && treeRootKey) treeRef.current.scrollTop = savedScrollTop;
  }, [savedScrollTop, treeRootKey]);

  useEffect(
    () => () => {
      if (scrollPersistTimerRef.current) clearTimeout(scrollPersistTimerRef.current);
      if (treeRootKey && pendingScrollTopRef.current !== null) {
        setScrollTop(treeRootKey, pendingScrollTopRef.current);
      }
    },
    [setScrollTop, treeRootKey],
  );

  return (
    <div
      ref={treeRef}
      data-testid="workspace-directory-browser"
      role="tree"
      tabIndex={-1}
      aria-label={t('chatWorkspaceProjectFiles')}
      className="min-h-0 flex-1 overflow-auto py-1 custom-scrollbar"
      onContextMenu={(event) => {
        if (!(event.target as HTMLElement).closest('[data-workspace-tree-entry]')) onBlankContext();
        onContextMenu?.(event);
      }}
      onScroll={(event) => {
        if (!treeRootKey) return;
        pendingScrollTopRef.current = event.currentTarget.scrollTop;
        if (scrollPersistTimerRef.current) clearTimeout(scrollPersistTimerRef.current);
        scrollPersistTimerRef.current = setTimeout(() => {
          scrollPersistTimerRef.current = null;
          if (pendingScrollTopRef.current !== null) setScrollTop(treeRootKey, pendingScrollTopRef.current);
        }, 120);
      }}
    >
      {showRoot && currentPath ? (
        <>
          {rootDraft}
          {children}
        </>
      ) : (
        children
      )}
    </div>
  );
}
