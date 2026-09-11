import type { ChatComposerDictationSession } from '@nextclaw/agent-chat-ui';
import { checkMicrophoneAccess, classifyMicrophoneError, isMicrophoneSecureContext } from '@/features/chat/utils/chat-voice-permissions.utils';

export type VoicePhase = 'idle' | 'ready' | 'starting' | 'recording' | 'stopping' | 'error';
export type VoiceError = 'insecure-context' | 'unsupported' | 'permission' | 'service-denied' | 'no-device' | 'device-busy' | 'network' | 'audio-capture' | 'no-speech' | 'interrupted' | 'timeout' | 'failed';
export type VoiceSnapshot = { phase: VoicePhase; text: string; interim: string; seconds: number; error: VoiceError | null };
export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};
type RecognitionConstructor = new () => SpeechRecognitionLike;
const createBrowserRecognition = (): SpeechRecognitionLike | null => {
  const host = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  const Constructor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  return Constructor ? new Constructor() : null;
};
const initialSnapshot = (): VoiceSnapshot => ({ phase: 'idle', text: '', interim: '', seconds: 0, error: null });
const isActive = (phase: VoicePhase) => ['starting', 'recording', 'stopping'].includes(phase);

/** Owns one explicit dictation session; never writes to the chat draft or sends messages. */
export class ChatVoiceInputManager {
  private snapshot = initialSnapshot();
  private listeners = new Set<() => void>();
  private recognition: SpeechRecognitionLike | null = null;
  private deadline: ReturnType<typeof setTimeout> | undefined;
  private ticker: ReturnType<typeof setInterval> | undefined;
  private context = '';
  private settingsRequested = false;
  private exitRequested = false;
  private draft: ChatComposerDictationSession | null = null;

  constructor(private readonly createRecognition = createBrowserRecognition,
    private readonly checkMicrophone = checkMicrophoneAccess,
    private readonly isSecureContext = isMicrophoneSecureContext) {}

  getSnapshot = (): VoiceSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private update = (patch: Partial<VoiceSnapshot>): void => {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  };
  open = (context: string): void => {
    if (this.snapshot.phase !== 'idle') return;
    this.context = context;
    this.update({ ...initialSnapshot(), phase: 'ready' });
  };
  openSettings = (): void => {
    this.settingsRequested = true;
    if (this.snapshot.phase === 'recording') { this.finish(); return; }
    if (this.snapshot.phase === 'stopping') return;
    const { context } = this;
    this.acceptDraft();
    this.open(context);
  };
  start = (language: string, context: string, draft: ChatComposerDictationSession | null): void => {
    if (isActive(this.snapshot.phase)) return;
    if (!draft) return;
    this.release();
    this.context = context;
    this.draft = draft;
    this.update({ ...initialSnapshot(), phase: 'starting' });
    try {
      if (!this.isSecureContext()) { this.fail('insecure-context'); return; }
      const recognition = this.createRecognition();
      if (!recognition) { this.fail('unsupported'); return; }
      this.recognition = recognition;
      recognition.lang = language === 'zh' ? 'zh-CN' : 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      this.connect(recognition);
      void this.checkAndStart(recognition);
    } catch (error) { this.fail(classifyMicrophoneError(error)); }
  };
  private checkAndStart = async (recognition: SpeechRecognitionLike): Promise<void> => {
    try {
      const error = await this.checkMicrophone();
      if (this.recognition !== recognition || this.snapshot.phase !== 'starting') return;
      if (error) { this.fail(error); return; }
      this.setDeadline(15000);
      recognition.start();
    } catch (error) {
      if (this.recognition === recognition) this.fail(classifyMicrophoneError(error));
    }
  };
  private connect = (recognition: SpeechRecognitionLike): void => {
    recognition.onstart = () => {
      if (this.recognition !== recognition || this.snapshot.phase !== 'starting') return;
      clearTimeout(this.deadline);
      this.update({ phase: 'recording' });
      const started = Date.now();
      this.ticker = setInterval(() => {
        const seconds = Math.floor((Date.now() - started) / 1000);
        this.update({ seconds });
        if (seconds >= 60) this.finish();
      }, 1000);
    };
    recognition.onresult = (event) => {
      if (this.recognition !== recognition) return;
      const finals: string[] = [];
      const interim: string[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim();
        if (text) (result.isFinal ? finals : interim).push(text);
      }
      this.update({ text: finals.join(' '), interim: interim.join(' ') });
      this.draft?.update(this.snapshot.text, this.snapshot.interim);
    };
    recognition.onerror = ({ error }) => {
      if (this.recognition !== recognition) return;
      const reason: VoiceError = error === 'service-not-allowed' ? 'service-denied' : error === 'not-allowed'
        ? 'permission'
        : error === 'network' || error === 'audio-capture' || error === 'no-speech' ? error : 'failed';
      this.fail(reason);
    };
    recognition.onend = () => {
      if (this.recognition !== recognition) return;
      if (this.exitRequested) { this.release(false); this.acceptDraft(); return; }
      const text = this.snapshot.text.trim();
      this.release(false);
      if (!text) { this.fail('no-speech'); return; }
      this.draft?.commit(text);
      this.draft = null;
      const { settingsRequested, context } = this;
      this.cancel();
      if (settingsRequested) this.open(context);
    };
  };
  finish = (): void => {
    if (this.snapshot.phase === 'starting') { this.cancel(); return; }
    if (this.snapshot.phase !== 'recording' || !this.recognition) return;
    clearInterval(this.ticker);
    this.update({ phase: 'stopping' });
    this.setDeadline(8000);
    try { this.recognition.stop(); } catch { this.fail('failed'); }
  };
  saveAndClose = (): void => {
    this.exitRequested = true;
    if (this.snapshot.phase === 'recording') { this.finish(); return; }
    if (this.snapshot.phase === 'stopping') return;
    this.acceptDraft();
  };
  interrupt = (): void => {
    if (isActive(this.snapshot.phase)) this.fail('interrupted');
  };
  acceptDraft = (): void => {
    this.draft?.commit();
    this.draft = null;
    this.cancel();
  };
  cancel = (): void => {
    this.settingsRequested = false;
    this.exitRequested = false;
    this.release();
    this.context = '';
    this.draft?.cancel();
    this.draft = null;
    this.update(initialSnapshot());
  };
  private fail = (error: VoiceError): void => {
    if (this.exitRequested) { this.acceptDraft(); return; }
    this.release();
    if (this.snapshot.text) this.draft?.commit(this.snapshot.text);
    else this.draft?.cancel();
    this.draft = null;
    this.update(this.settingsRequested ? { ...initialSnapshot(), phase: 'ready' } : { phase: 'error', error, interim: '' });
    this.settingsRequested = false;
  };
  private setDeadline = (milliseconds: number): void => {
    clearTimeout(this.deadline);
    this.deadline = setTimeout(() => this.fail('timeout'), milliseconds);
  };
  private release = (abort = true): void => {
    clearTimeout(this.deadline);
    clearInterval(this.ticker);
    const { recognition } = this;
    this.recognition = null;
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onend = null;
    recognition.onerror = null;
    recognition.onresult = null;
    if (abort) {
      try { recognition.abort(); } catch { /* Already released by the browser. */ }
    }
  };
}
