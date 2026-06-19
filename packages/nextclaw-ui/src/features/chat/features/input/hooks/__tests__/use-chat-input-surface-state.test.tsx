import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useChatInputSurfaceState } from '@/features/chat/features/input/hooks/use-chat-input-surface-state';

vi.mock('@/features/panel-apps', () => ({
  usePanelApps: () => ({
    data: { entries: [] },
    isFetching: false,
    isLoading: false,
  }),
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
    onSelectSkill: vi.fn(),
    recentSkillValues: [],
    skillRecords: [],
  };
}

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
