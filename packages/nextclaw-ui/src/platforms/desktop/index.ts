export {
  desktopPresenceManager,
  DesktopPresenceManager,
} from './managers/desktop-presence.manager';
export {
  desktopUpdateManager,
  DesktopUpdateManager,
} from './managers/desktop-update.manager';
export { useDesktopPresenceStore } from './stores/desktop-presence.store';
export { useDesktopUpdateStore } from './stores/desktop-update.store';
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
