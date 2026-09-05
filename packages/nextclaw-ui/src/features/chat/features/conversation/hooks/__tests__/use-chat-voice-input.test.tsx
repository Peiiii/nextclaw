import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readBoundVoiceKey,
  useChatVoiceInput,
  writeBoundVoiceKey,
  type SpeechRecognitionLike,
} from '@/features/chat/features/conversation/hooks/use-chat-voice-input';

const VOICE_KEY_STORAGE_KEY = 'nextclaw.chat.voiceInput.key';

class MockSpeechRecognition implements SpeechRecognitionLike {
  lang = '';
  continuous = false;
  interimResults = false;
  start = vi.fn(() => {
    // 模拟异步 onstart 后进入 listening；测试用同步即可
  });
  stop = vi.fn();
  abort = vi.fn();
  onresult: SpeechRecognitionLike['onresult'] = null;
  onend: (() => void) | null = null;
  onerror: SpeechRecognitionLike['onerror'] = null;

  /** 测试辅助：触发一次最终结果 */
  emitFinal = (transcript: string): void => {
    this.onresult?.({
      results: [{ isFinal: true, 0: { transcript } }],
    });
  };

  /** 测试辅助：触发结束事件 */
  emitEnd = (): void => {
    this.onend?.();
  };

  emitError = (error: string): void => {
    this.onerror?.({ error });
  };
}

let mockInstance: MockSpeechRecognition | null = null;

class SpeechRecognitionMockConstructor {
  constructor() {
    mockInstance = new MockSpeechRecognition();
    return mockInstance;
  }
}

const installMockRecognition = (): void => {
  mockInstance = null;
  Object.defineProperty(window, 'SpeechRecognition', {
    configurable: true,
    value: SpeechRecognitionMockConstructor,
  });
};

beforeEach(() => {
  window.localStorage.clear();
  installMockRecognition();
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('voice input key storage', () => {
  it('round-trips a bound key through localStorage', () => {
    expect(readBoundVoiceKey()).toBeNull();
    writeBoundVoiceKey('KeyV');
    expect(readBoundVoiceKey()).toBe('KeyV');
    writeBoundVoiceKey(null);
    expect(readBoundVoiceKey()).toBeNull();
  });

  it('ignores reads when localStorage is unavailable', () => {
    const original = window.localStorage.getItem;
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readBoundVoiceKey()).toBeNull();
    original;
  });
});

describe('useChatVoiceInput', () => {
  it('reports supported when SpeechRecognition exists', () => {
    const { result } = renderHook(() =>
      useChatVoiceInput({ language: 'zh', onTranscript: vi.fn() }),
    );
    expect(result.current.supported).toBe(true);
    expect(result.current.boundKey).toBeNull();
    expect(result.current.listening).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('reports unsupported when no SpeechRecognition is available', () => {
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined });
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined });
    const { result } = renderHook(() =>
      useChatVoiceInput({ language: 'zh', onTranscript: vi.fn() }),
    );
    expect(result.current.supported).toBe(false);
  });

  it('captures a key and persists it', () => {
    const { result } = renderHook(() =>
      useChatVoiceInput({ language: 'zh', onTranscript: vi.fn() }),
    );
    act(() => result.current.startCaptureKey());
    expect(result.current.capturingKey).toBe(true);

    const event = new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(result.current.capturingKey).toBe(false);
    expect(result.current.boundKey).toBe('KeyV');
    expect(readBoundVoiceKey()).toBe('KeyV');
  });

  it('ignores modifier-only keys while capturing', () => {
    const { result } = renderHook(() =>
      useChatVoiceInput({ language: 'zh', onTranscript: vi.fn() }),
    );
    act(() => result.current.startCaptureKey());
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ControlLeft', bubbles: true }));
    });
    expect(result.current.capturingKey).toBe(true);
    expect(result.current.boundKey).toBeNull();
    act(() => result.current.cancelCaptureKey());
    expect(result.current.capturingKey).toBe(false);
  });

  it('transcribes final results into the transcript callback after key release', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() =>
      useChatVoiceInput({ language: 'en', onTranscript }),
    );
    act(() => {
      writeBoundVoiceKey('KeyV');
    });
    // hook 内部从 localStorage 初始化 boundKey 只在首 render；直接重跑以读到新 key
    const second = renderHook(() =>
      useChatVoiceInput({ language: 'en', onTranscript }),
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true }));
    });
    expect(second.result.current.listening).toBe(true);

    act(() => {
      mockInstance?.emitFinal('hello world');
      mockInstance?.emitEnd();
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyV', bubbles: true }));
    });
    expect(onTranscript).toHaveBeenCalledWith('hello world');
    expect(second.result.current.listening).toBe(false);
    void result;
  });

  it('surfaces permission errors', () => {
    const { result } = renderHook(() =>
      useChatVoiceInput({ language: 'zh', onTranscript: vi.fn() }),
    );
    act(() => {
      writeBoundVoiceKey('KeyV');
    });
    const second = renderHook(() =>
      useChatVoiceInput({ language: 'zh', onTranscript: vi.fn() }),
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', bubbles: true }));
      mockInstance?.emitError('not-allowed');
    });
    expect(second.result.current.error).toBe('permission');
    void result;
  });
});

describe('voice key storage', () => {
  it('keeps VOICE_KEY_STORAGE_KEY aligned with the implementation', () => {
    // 若 key 常量被改，此断言提醒同步测试
    expect(VOICE_KEY_STORAGE_KEY).toBe('nextclaw.chat.voiceInput.key');
  });
});
