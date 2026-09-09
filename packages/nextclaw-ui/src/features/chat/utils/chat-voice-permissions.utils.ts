export type MicrophoneError = 'permission' | 'no-device' | 'device-busy' | 'unsupported' | 'failed';

export function classifyMicrophoneError(error: unknown): MicrophoneError {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'NotSupportedError') return 'unsupported';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'permission';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'no-device';
  if (name === 'NotReadableError' || name === 'AbortError') return 'device-busy';
  return 'failed';
}

/** Check on explicit start/retry; release every track even if the panel was closed. */
export async function checkMicrophoneAccess(): Promise<MicrophoneError | null> {
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return null;
  } catch (error) {
    return classifyMicrophoneError(error);
  }
}

export function voicePermissionInstructionKeys(userAgent: string): string[] {
  const system = /iPhone|iPad|iPod/i.test(userAgent) ? 'chatInputVoicePermissionIos'
    : /Android/i.test(userAgent) ? 'chatInputVoicePermissionAndroid'
    : /Macintosh|Mac OS X/i.test(userAgent) ? 'chatInputVoicePermissionMac'
    : /Windows/i.test(userAgent) ? 'chatInputVoicePermissionWindows'
    : 'chatInputVoicePermissionSystem';
  return [/Electron/i.test(userAgent) ? 'chatInputVoicePermissionDesktop' : 'chatInputVoicePermissionBrowser', system];
}
