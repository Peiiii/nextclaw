import { afterEach, expect, it, vi } from 'vitest';
import { checkMicrophoneAccess, classifyMicrophoneError, voicePermissionInstructionKeys } from './chat-voice-permissions.utils';

afterEach(() => vi.unstubAllGlobals());

it.each([
  ['NotAllowedError', 'permission'], ['NotFoundError', 'no-device'],
  ['NotSupportedError', 'unsupported'],
  ['NotReadableError', 'device-busy'], ['AbortError', 'device-busy'], ['Error', 'failed'],
])('classifies %s from the actual media API', (name, expected) => {
  expect(classifyMicrophoneError(new DOMException('microphone', name))).toBe(expected);
});

it('rechecks access and immediately releases every captured track', async () => {
  const stop = vi.fn();
  const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }, { stop }] });
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  expect(await checkMicrophoneAccess()).toBeNull();
  expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
  expect(stop).toHaveBeenCalledTimes(2);
});

it('reports unavailable media API and an actual denial without caching', async () => {
  vi.stubGlobal('navigator', {});
  expect(await checkMicrophoneAccess()).toBe('unsupported');
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('', 'NotAllowedError')) } });
  expect(await checkMicrophoneAccess()).toBe('permission');
});

it.each([
  ['Macintosh Chrome', 'Mac'], ['Windows Chrome', 'Windows'], ['iPhone', 'Ios'],
  ['Android Chrome', 'Android'], ['Linux', 'System'],
])('offers instructions matching %s', (ua, platform) => {
  expect(voicePermissionInstructionKeys(ua)).toEqual(['chatInputVoicePermissionBrowser', `chatInputVoicePermission${platform}`]);
  expect(voicePermissionInstructionKeys(`${ua} Electron`)[0]).toBe('chatInputVoicePermissionDesktop');
});
