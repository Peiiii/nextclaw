import { afterEach, expect, it, vi } from 'vitest';
import { checkMicrophoneAccess, classifyMicrophoneError, voicePermissionInstructionKeys } from './chat-voice-permissions.utils';
import { setLanguage, t } from '@/shared/lib/i18n';

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

it('distinguishes insecure HTTP from an unsupported media API and an actual denial', async () => {
  vi.stubGlobal('isSecureContext', false);
  vi.stubGlobal('navigator', {});
  expect(await checkMicrophoneAccess()).toBe('insecure-context');
  vi.stubGlobal('isSecureContext', true);
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

it('explains the VPS HTTPS recovery path in both supported languages', () => {
  setLanguage('zh');
  expect(t('chatInputVoiceInsecureContext')).toContain('VPS 配置 HTTPS');
  setLanguage('en');
  expect(t('chatInputVoiceInsecureContext')).toContain('Configure HTTPS for a VPS');
});
