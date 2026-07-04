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

vi.mock('@/features/panel-apps', () => ({
  usePanelApps: usePanelAppsMock,
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
    recentSkillValues: [],
    skillRecords: [],
  };
}

beforeEach(() => {
  usePanelAppsMock.mockClear();
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
