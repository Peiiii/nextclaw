import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resolveSessionTypeLabel, useChatSessionTypeState } from './use-chat-session-type-state';

vi.mock('@/lib/i18n', () => ({
  t: (key: string) => key
}));

describe('useChatSessionTypeState', () => {
  it('formats non-native runtime labels generically when no explicit label is provided', () => {
    expect(resolveSessionTypeLabel('workspace-agent')).toBe('Workspace Agent');
  });

  it('preserves an explicitly selected draft session type instead of resetting to the default', () => {
    const setPendingSessionType = vi.fn();

    const { result } = renderHook(() =>
      useChatSessionTypeState({
        selectedSession: null,
        pendingSessionType: 'codex-sdk',
        setPendingSessionType,
        sessionTypesData: {
          defaultType: 'native',
          options: [
            { value: 'native', label: 'Native' },
            { value: 'codex-sdk', label: 'Codex' }
          ]
        }
      })
    );

    expect(result.current.selectedSessionType).toBe('codex-sdk');
    expect(setPendingSessionType).not.toHaveBeenCalled();
  });

  it('hydrates the draft session type from the runtime default when no explicit type exists', () => {
    const setPendingSessionType = vi.fn();

    renderHook(() =>
      useChatSessionTypeState({
        selectedSession: null,
        pendingSessionType: '',
        setPendingSessionType,
        sessionTypesData: {
          defaultType: 'codex-sdk',
          options: [
            { value: 'native', label: 'Native' },
            { value: 'codex-sdk', label: 'Codex' }
          ]
        }
      })
    );

    expect(setPendingSessionType).toHaveBeenCalledWith('codex-sdk');
  });

  it('marks the selected draft session type as unavailable when runtime setup is incomplete', () => {
    const setPendingSessionType = vi.fn();

    const { result } = renderHook(() =>
      useChatSessionTypeState({
        selectedSession: null,
        pendingSessionType: 'claude',
        setPendingSessionType,
        sessionTypesData: {
          defaultType: 'native',
          options: [
            { value: 'native', label: 'Native', ready: true },
            {
              value: 'claude',
              label: 'Claude',
              ready: false,
              reasonMessage: 'Configure a provider API key first.'
            }
          ]
        }
      })
    );

    expect(result.current.selectedSessionTypeOption?.ready).toBe(false);
    expect(result.current.sessionTypeUnavailable).toBe(true);
    expect(result.current.sessionTypeUnavailableMessage).toBe('Configure a provider API key first.');
  });
});
