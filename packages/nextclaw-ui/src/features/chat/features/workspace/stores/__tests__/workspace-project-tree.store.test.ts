import { beforeEach, describe, expect, it } from 'vitest';
import { useWorkspaceProjectTreeStore } from '@/features/chat/features/workspace/stores/workspace-project-tree.store';

const ROOT = '/Users/peiwang/Projects/nextbot';

describe('workspace project tree store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useWorkspaceProjectTreeStore.setState({ trees: {} });
  });

  it('keeps expansion and scroll view state isolated by project root', () => {
    const store = useWorkspaceProjectTreeStore.getState();
    store.setDirectoryExpanded(ROOT, 'src/features', true);
    store.setScrollTop(ROOT, 128.4);
    store.setDirectoryExpanded('/tmp/another-project', 'docs', true);

    expect(useWorkspaceProjectTreeStore.getState().trees[ROOT]).toMatchObject({
      expandedPaths: ['src/features'],
      scrollTop: 128,
    });
    expect(useWorkspaceProjectTreeStore.getState().trees['/tmp/another-project']).toMatchObject({
      expandedPaths: ['docs'],
      scrollTop: 0,
    });
  });

  it('normalizes paths and collapses only the requested project', () => {
    const store = useWorkspaceProjectTreeStore.getState();
    store.setDirectoryExpanded(`${ROOT}/`, '/src\\features/', true);
    store.setDirectoryExpanded(ROOT, 'src/features', true);
    store.setDirectoryExpanded('/tmp/another-project', 'docs', true);
    useWorkspaceProjectTreeStore.getState().collapseAll(ROOT);

    expect(useWorkspaceProjectTreeStore.getState().trees[ROOT]?.expandedPaths).toEqual([]);
    expect(useWorkspaceProjectTreeStore.getState().trees['/tmp/another-project']?.expandedPaths).toEqual(['docs']);
  });
});
