import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Web Speech API 的 SpeechRecognition 不在标准 TS lib 内，这里做最小类型声明。
 * 桌面 web（Chromium/Electron 壳）通常暴露 webkitSpeechRecognition。
 */

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
};

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
};

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructorLike;
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  }
}

const resolveSpeechRecognition = (): SpeechRecognitionConstructorLike | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
};

const toSpeechLocale = (language: string): string => (language === "zh" ? "zh-CN" : "en-US");

const VOICE_KEY_STORAGE_KEY = "nextclaw.chat.voiceInput.key";

export const readBoundVoiceKey = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(VOICE_KEY_STORAGE_KEY);
  } catch {
    // 隐私模式/存储被禁用时读取会抛错，语音输入保持未绑定可用
    return null;
  }
};

export const writeBoundVoiceKey = (key: string | null): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (key === null) {
      window.localStorage.removeItem(VOICE_KEY_STORAGE_KEY);
    } else {
      window.localStorage.setItem(VOICE_KEY_STORAGE_KEY, key);
    }
  } catch {
    // 隐私模式/存储被禁用时忽略持久化失败，仅本次会话内保持绑定
  }
};

export type UseChatVoiceInputOptions = {
  /** UI 语言（'zh' | 'en'），决定 SpeechRecognition lang */
  language: string;
  /** 一段语音最终转写完成后回调；宿主负责把文本放进输入区（不自动发送） */
  onTranscript: (text: string) => void;
};

export type UseChatVoiceInputResult = {
  /** 浏览器是否支持 SpeechRecognition */
  supported: boolean;
  /** 当前是否正在录音 */
  listening: boolean;
  /** 最近一次错误信息（权限拒绝/无语音/不支持）；无错误为 null */
  error: string | null;
  /** 已绑定的按住说话键（e.code，如 "Space"）；未绑定为 null */
  boundKey: string | null;
  /** 是否处于"捕获按键"模式（首次引导/重新绑定） */
  capturingKey: boolean;
  /** 捕获下一次按下的非修饰键作为语音键 */
  startCaptureKey: () => void;
  /** 取消捕获模式 */
  cancelCaptureKey: () => void;
};

const isModifierLike = (code: string): boolean =>
  ["ControlLeft", "ControlRight", "ShiftLeft", "ShiftRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight", "CapsLock"].includes(code);

/** 会在输入框里产生字符或影响编辑的按键，绑定这些键会导致打字与语音冲突。 */
const isTextOrEditingCode = (code: string): boolean =>
  /^Key[A-Z]$/.test(code) ||
  /^Digit\d$/.test(code) ||
  /^Numpad/.test(code) ||
  code.startsWith("Arrow") ||
  ["Space", "Enter", "Tab", "Backspace", "Delete", "Home", "End", "PageUp", "PageDown", "Escape"].includes(code) ||
  /^F\d+$/.test(code);

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA";
};

export function useChatVoiceInput({
  language,
  onTranscript,
}: UseChatVoiceInputOptions): UseChatVoiceInputResult {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const supportedRef = useRef<boolean>(false);
  const listeningRef = useRef<boolean>(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boundKey, setBoundKey] = useState<string | null>(() => readBoundVoiceKey());
  const [capturingKey, setCapturingKey] = useState(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const bufferRef = useRef<string[]>([]);

  const resolveRecognition = useCallback((): SpeechRecognitionLike | null => {
    if (recognitionRef.current) {
      return recognitionRef.current;
    }
    const Constructor = resolveSpeechRecognition();
    if (!Constructor) {
      return null;
    }
    const recognition = new Constructor();
    recognition.lang = toSpeechLocale(language);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event): void => {
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          const transcript = result[0]?.transcript?.trim();
          if (transcript) {
            bufferRef.current.push(transcript);
          }
        }
      }
    };
    recognition.onerror = (event): void => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("permission");
      } else if (event.error === "no-speech") {
        setError("no-speech");
      } else {
        setError(event.error);
      }
    };
    recognition.onend = (): void => {
      listeningRef.current = false;
      setListening(false);
      const pending = bufferRef.current;
      bufferRef.current = [];
      if (pending.length > 0) {
        onTranscriptRef.current(pending.join(" "));
      }
    };
    recognitionRef.current = recognition;
    return recognition;
  }, [language]);

  const startListening = useCallback((): void => {
    if (listeningRef.current) {
      return;
    }
    const recognition = resolveRecognition();
    if (!recognition) {
      setError("unsupported");
      return;
    }
    bufferRef.current = [];
    setError(null);
    try {
      recognition.start();
      listeningRef.current = true;
      setListening(true);
    } catch {
      // 重复 start 等场景静默忽略，onend 会复位状态
    }
  }, [resolveRecognition]);

  const stopListening = useCallback((): void => {
    const recognition = recognitionRef.current;
    if (!recognition || !listeningRef.current) {
      return;
    }
    try {
      recognition.stop();
    } catch {
      listeningRef.current = false;
      setListening(false);
    }
  }, []);

  // 按住绑定键说话：keydown 开始，keyup 结束
  useEffect(() => {
    if (!boundKey) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat || event.code !== boundKey) {
        return;
      }
      // 输入框内打字时让位：纯字符/编辑键且未带修饰组合时不抢占，避免吞掉正常输入
      if (isEditableTarget(event.target) && isTextOrEditingCode(boundKey) && !event.ctrlKey && !event.metaKey && !event.altKey) {
        return;
      }
      event.preventDefault();
      startListening();
    };
    const handleKeyUp = (event: KeyboardEvent): void => {
      if (event.code === boundKey) {
        stopListening();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [boundKey, startListening, stopListening]);

  // 捕获模式：按下任意非修饰键即绑定（首次引导 / 手动重绑）
  useEffect(() => {
    if (!capturingKey) {
      return undefined;
    }
    const handleCapture = (event: KeyboardEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      if (isModifierLike(event.code)) {
        return;
      }
      writeBoundVoiceKey(event.code);
      setBoundKey(event.code);
      setCapturingKey(false);
      setError(null);
    };
    window.addEventListener("keydown", handleCapture, true);
    return () => {
      window.removeEventListener("keydown", handleCapture, true);
    };
  }, [capturingKey]);

  const startCaptureKey = useCallback((): void => {
    stopListening();
    setCapturingKey(true);
  }, [stopListening]);

  const cancelCaptureKey = useCallback((): void => {
    setCapturingKey(false);
  }, []);

  return {
    supported: supportedRef.current || resolveSpeechRecognition() !== null,
    listening,
    error,
    boundKey,
    capturingKey,
    startCaptureKey,
    cancelCaptureKey,
  };
}
