export {
  desktopPresenceManager,
  DesktopPresenceManager,
} from './managers/desktop-presence.manager';
export {
  desktopUpdateManager,
  DesktopUpdateManager,
} from './managers/desktop-update.manager';
export { DesktopAppShell } from './components/desktop-app-shell';
export { DesktopWindowChrome } from './components/desktop-window-chrome';
export { useDesktopPresenceStore } from './stores/desktop-presence.store';
export { useDesktopUpdateStore } from './stores/desktop-update.store';
export {
  getDesktopHostPlatform,
  isMacDesktopHost,
  isWindowsDesktopHost,
} from './utils/desktop-host.utils';
export type {
  DesktopPresencePreferences,
  DesktopPresenceSnapshot,
  DesktopReleaseChannel,
  DesktopRuntimeControlResult,
  DesktopUpdatePreferences,
  DesktopUpdateSnapshot,
  DesktopUpdateStatus,
  NextClawDesktopBridge,
} from './types/desktop-update.types';
