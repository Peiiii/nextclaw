import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const WORKSPACE_PROJECT_TREE_STORAGE_KEY = 'nextclaw.chat.workspace-project-tree.state';
const WORKSPACE_PROJECT_TREE_STORAGE_VERSION = 1;
const MAX_PERSISTED_PROJECT_TREES = 12;
const MAX_PERSISTED_EXPANDED_PATHS = 256;
const MAX_PERSISTED_SCROLL_TOP = 10_000_000;

export type WorkspaceProjectTreeViewState = {
  expandedPaths: string[];
  scrollTop: number;
  updatedAt: number;
};

type WorkspaceProjectTreeStore = {
  trees: Record<string, WorkspaceProjectTreeViewState>;
  collapseAll: (rootPath: string) => void;
  setDirectoryExpanded: (rootPath: string, relativePath: string, expanded: boolean) => void;
  setScrollTop: (rootPath: string, scrollTop: number) => void;
};

type PersistedWorkspaceProjectTreeStore = Pick<WorkspaceProjectTreeStore, 'trees'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

export function normalizeWorkspaceProjectTreeRootKey(path: string | null | undefined): string {
  const normalized = path?.trim().replace(/\\/g, '/').replace(/\/+$/g, '') ?? '';
  return normalized || (path?.trim() === '/' ? '/' : '');
}

export function normalizeWorkspaceProjectTreeRelativePath(path: string | null | undefined): string {
  return path?.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/') ?? '';
}

function normalizeScrollTop(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(0, Math.round(value)), MAX_PERSISTED_SCROLL_TOP);
}

function normalizeUpdatedAt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function normalizeExpandedPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((path) => (typeof path === 'string' ? normalizeWorkspaceProjectTreeRelativePath(path) : ''))
        .filter(Boolean),
    ),
  ).slice(0, MAX_PERSISTED_EXPANDED_PATHS);
}

function normalizePersistedTrees(value: unknown): Record<string, WorkspaceProjectTreeViewState> {
  if (!isRecord(value)) return {};
  return Object.entries(value)
    .map(([rootPath, tree]) => {
      const rootKey = normalizeWorkspaceProjectTreeRootKey(rootPath);
      if (!rootKey || !isRecord(tree)) return null;
      return [
        rootKey,
        {
          expandedPaths: normalizeExpandedPaths(tree.expandedPaths),
          scrollTop: normalizeScrollTop(tree.scrollTop),
          updatedAt: normalizeUpdatedAt(tree.updatedAt),
        },
      ] as const;
    })
    .filter((entry): entry is readonly [string, WorkspaceProjectTreeViewState] => entry !== null)
    .sort((left, right) => right[1].updatedAt - left[1].updatedAt)
    .slice(0, MAX_PERSISTED_PROJECT_TREES)
    .reduce<Record<string, WorkspaceProjectTreeViewState>>((trees, [rootKey, tree]) => {
      trees[rootKey] = tree;
      return trees;
    }, {});
}

function retainRecentTrees(
  trees: Record<string, WorkspaceProjectTreeViewState>,
): Record<string, WorkspaceProjectTreeViewState> {
  return normalizePersistedTrees(trees);
}

function createTreeViewState(): WorkspaceProjectTreeViewState {
  return { expandedPaths: [], scrollTop: 0, updatedAt: Date.now() };
}

export const useWorkspaceProjectTreeStore = create<WorkspaceProjectTreeStore>()(
  persist(
    (set) => ({
      trees: {},
      collapseAll: (rootPath) => {
        const rootKey = normalizeWorkspaceProjectTreeRootKey(rootPath);
        if (!rootKey) return;
        set((state) => {
          const current = state.trees[rootKey];
          if (!current || current.expandedPaths.length === 0) return state;
          return {
            trees: retainRecentTrees({
              ...state.trees,
              [rootKey]: { ...current, expandedPaths: [], updatedAt: Date.now() },
            }),
          };
        });
      },
      setDirectoryExpanded: (rootPath, relativePath, expanded) => {
        const rootKey = normalizeWorkspaceProjectTreeRootKey(rootPath);
        const pathKey = normalizeWorkspaceProjectTreeRelativePath(relativePath);
        if (!rootKey || !pathKey) return;
        set((state) => {
          const current = state.trees[rootKey] ?? createTreeViewState();
          const expandedPaths = expanded
            ? Array.from(new Set([...current.expandedPaths, pathKey])).slice(0, MAX_PERSISTED_EXPANDED_PATHS)
            : current.expandedPaths.filter((path) => path !== pathKey);
          if (
            expandedPaths.length === current.expandedPaths.length &&
            expandedPaths.every((path, index) => path === current.expandedPaths[index])
          ) {
            return state;
          }
          return {
            trees: retainRecentTrees({
              ...state.trees,
              [rootKey]: { ...current, expandedPaths, updatedAt: Date.now() },
            }),
          };
        });
      },
      setScrollTop: (rootPath, scrollTop) => {
        const rootKey = normalizeWorkspaceProjectTreeRootKey(rootPath);
        if (!rootKey) return;
        const normalizedScrollTop = normalizeScrollTop(scrollTop);
        set((state) => {
          const current = state.trees[rootKey] ?? createTreeViewState();
          if (current.scrollTop === normalizedScrollTop) return state;
          return {
            trees: retainRecentTrees({
              ...state.trees,
              [rootKey]: { ...current, scrollTop: normalizedScrollTop, updatedAt: Date.now() },
            }),
          };
        });
      },
    }),
    {
      name: WORKSPACE_PROJECT_TREE_STORAGE_KEY,
      version: WORKSPACE_PROJECT_TREE_STORAGE_VERSION,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state): PersistedWorkspaceProjectTreeStore => ({ trees: state.trees }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        trees: normalizePersistedTrees(isRecord(persistedState) ? persistedState.trees : null),
      }),
    },
  ),
);
