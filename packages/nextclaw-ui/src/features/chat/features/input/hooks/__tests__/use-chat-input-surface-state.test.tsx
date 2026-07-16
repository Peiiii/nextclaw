import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useChatInputSurfaceState } from '@/features/chat/features/input/hooks/use-chat-input-surface-state';

const usePanelAppsMock = vi.hoisted(() =>
  vi.fn(() => ({
    data: { entries: [] },
    isFetching: false,
    isLoading: false,
  })),
);
const useServerPathSearchMock = vi.hoisted(() =>
  vi.fn(() => ({
    data: { entries: [] },
    error: null,
    isFetching: false,
    isLoading: false,
  })),
);
const useServerPathBrowseMock = vi.hoisted(() =>
  vi.fn(() => ({
    data: {
      entries: [
        {
          name: 'src',
          path: '/tmp/project/src',
          kind: 'directory' as const,
          hidden: false,
        },
      ],
    },
    error: null,
    isFetching: false,
    isLoading: false,
  })),
);

vi.mock('@/features/panel-apps', () => ({
  usePanelApps: usePanelAppsMock,
}));
vi.mock('@/shared/hooks/use-server-path-search', () => ({
  useServerPathSearch: useServerPathSearchMock,
}));
vi.mock('@/shared/hooks/use-server-path-browse', () => ({
  useServerPathBrowse: useServerPathBrowseMock,
}));

function createHookParams() {
  return {
    commands: [],
    isSkillsLoading: false,
    itemTexts: {
      slashTexts: {
        noSkillDescription: 'No description',
        slashSkillScopeLabel: 'Scope',
        slashSkillSpecLabel: 'Spec',
        slashSkillSubtitle: 'Skill',
      },
    },
    language: 'zh' as const,
    onSelectPanelApp: vi.fn(),
    onSelectSkill: vi.fn(),
    projectRoot: '/tmp/project',
    recentSkillValues: [],
    skillRecords: [],
  };
}

beforeEach(() => {
  usePanelAppsMock.mockClear();
  useServerPathBrowseMock.mockClear();
  useServerPathSearchMock.mockClear();
});

it('browses nested folders while reserving search for project-wide queries', () => {
  const { result } = renderHook(() => useChatInputSurfaceState(createHookParams()));

  act(() =>
    result.current.setInputSurfaceTrigger({
      end: 1,
      key: 'context-reference',
      marker: '@',
      query: '',
      start: 0,
    }),
  );
  const filesItem = result.current.inputSurfaceState.panel?.items.find(
    (item) => item.selectionBehavior === 'navigate',
  );
  act(() => result.current.inputSurfaceState.panel?.onSelectItem?.(filesItem!));

  expect(useServerPathBrowseMock).toHaveBeenLastCalledWith({
    path: '.',
    basePath: '/tmp/project',
    includeFiles: true,
    enabled: true,
  });
  const directoryItem = result.current.inputSurfaceState.panel?.items.find(
    (item) => item.title === 'src',
  );
  act(() => result.current.inputSurfaceState.panel?.onSelectItem?.(directoryItem!));
  expect(useServerPathBrowseMock).toHaveBeenLastCalledWith({
    path: 'src',
    basePath: '/tmp/project',
    includeFiles: true,
    enabled: true,
  });

  act(() => result.current.setInputSurfaceTrigger({
    end: 7,
    key: 'context-reference',
    marker: '@',
    query: 'needle',
    start: 0,
  }));
  expect(useServerPathSearchMock).toHaveBeenLastCalledWith({
    basePath: '/tmp/project',
    query: 'needle',
    enabled: true,
  });
});

it('keeps equivalent input surface trigger updates from rerendering the composer owner', () => {
  let renderCount = 0;
  const trigger = {
    end: 4,
    key: 'slash',
    marker: '/',
    query: 'xxx',
    start: 0,
  };
  const { result } = renderHook(() => {
    renderCount += 1;
    return useChatInputSurfaceState(createHookParams());
  });

  expect(renderCount).toBe(1);

  act(() => result.current.setInputSurfaceTrigger(trigger));
  expect(renderCount).toBe(2);

  act(() => result.current.setInputSurfaceTrigger({ ...trigger }));
  expect(renderCount).toBe(2);

  act(() => result.current.setInputSurfaceTrigger({ ...trigger, end: 3, query: 'xx' }));
  expect(renderCount).toBe(3);
});

it('loads panel apps for slash trigger panel actions', () => {
  const { result } = renderHook(() => useChatInputSurfaceState(createHookParams()));

  act(() =>
    result.current.setInputSurfaceTrigger({
      end: 5,
      key: 'slash',
      marker: '/',
      query: 'task',
      start: 0,
    }),
  );

  expect(usePanelAppsMock).toHaveBeenLastCalledWith({ enabled: true });
});
