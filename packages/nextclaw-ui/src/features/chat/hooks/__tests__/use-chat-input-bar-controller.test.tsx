import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useChatInputBarController } from '@/features/chat/hooks/use-chat-input-bar-controller';

function createKeyEvent(
  key: string,
  overrides?: Partial<ReactKeyboardEvent<HTMLTextAreaElement>>
): ReactKeyboardEvent<HTMLTextAreaElement> {
  return {
    key,
    code: key === ' ' ? 'Space' : key,
    shiftKey: false,
    nativeEvent: {
      isComposing: false
    },
    preventDefault: vi.fn(),
    ...overrides
  } as unknown as ReactKeyboardEvent<HTMLTextAreaElement>;
}

describe('useChatInputBarController', () => {
  it('cycles slash items with arrow keys and selects the active item on enter', () => {
    const onSelectSlashItem = vi.fn();
    const { result } = renderHook(() =>
      useChatInputBarController({
        isSlashMode: true,
        slashItems: [
          { key: 'one', title: 'One', subtitle: 'Skill', description: '', detailLines: [] },
          { key: 'two', title: 'Two', subtitle: 'Skill', description: '', detailLines: [] }
        ],
        isSlashLoading: false,
        onSelectSlashItem,
        onSend: vi.fn(),
        onStop: vi.fn(),
        isSending: false,
        canStopGeneration: false
      })
    );

    act(() => {
      result.current.onTextareaKeyDown(createKeyEvent('ArrowDown'));
    });
    expect(result.current.activeSlashIndex).toBe(1);

    act(() => {
      result.current.onTextareaKeyDown(createKeyEvent('Enter'));
    });
    expect(onSelectSlashItem).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'two'
      })
    );
  });

  it('dismisses the slash panel on space and triggers stop on escape outside slash mode', () => {
    const onStop = vi.fn();
    const { result, rerender } = renderHook(
      (props: {
        isSlashMode: boolean;
        isSending: boolean;
        canStopGeneration: boolean;
      }) =>
        useChatInputBarController({
          isSlashMode: props.isSlashMode,
          slashItems: [{ key: 'one', title: 'One', subtitle: 'Skill', description: '', detailLines: [] }],
          isSlashLoading: false,
          onSelectSlashItem: vi.fn(),
          onSend: vi.fn(),
          onStop,
          isSending: props.isSending,
          canStopGeneration: props.canStopGeneration
        }),
      {
        initialProps: {
          isSlashMode: true,
          isSending: false,
          canStopGeneration: false
        }
      }
    );

    act(() => {
      result.current.onTextareaKeyDown(createKeyEvent(' '));
    });
    expect(result.current.isSlashPanelOpen).toBe(false);

    rerender({
      isSlashMode: false,
      isSending: true,
      canStopGeneration: true
    });

    act(() => {
      result.current.onTextareaKeyDown(createKeyEvent('Escape'));
    });
    expect(onStop).toHaveBeenCalled();
  });

  it('supports Tab selection and Enter send when slash mode is not active', () => {
    const onSelectSlashItem = vi.fn();
    const onSend = vi.fn();
    const { result, rerender } = renderHook(
      (props: { isSlashMode: boolean }) =>
        useChatInputBarController({
          isSlashMode: props.isSlashMode,
          slashItems: [{ key: 'one', title: 'One', subtitle: 'Skill', description: '', detailLines: [] }],
          isSlashLoading: false,
          onSelectSlashItem,
          onSend,
          onStop: vi.fn(),
          isSending: false,
          canStopGeneration: false
        }),
      { initialProps: { isSlashMode: true } }
    );

    act(() => {
      result.current.onTextareaKeyDown(createKeyEvent('Tab'));
    });
    expect(onSelectSlashItem).toHaveBeenCalledTimes(1);

    rerender({ isSlashMode: false });
    act(() => {
      result.current.onTextareaKeyDown(createKeyEvent('Enter'));
    });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('does not send on enter while a response is still running', () => {
    const onSend = vi.fn();
    const event = createKeyEvent('Enter');
    const { result } = renderHook(() =>
      useChatInputBarController({
        isSlashMode: false,
        slashItems: [],
        isSlashLoading: false,
        onSelectSlashItem: vi.fn(),
        onSend,
        onStop: vi.fn(),
        isSending: true,
        canStopGeneration: true
      })
    );

    act(() => {
      result.current.onTextareaKeyDown(event);
    });

    expect(onSend).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });
});
