/// <reference types="vite/client" />

import type { NextClawDesktopBridge } from './desktop/desktop-update.types';

export {};

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_DEV_PROXY_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    nextclawDesktop?: NextClawDesktopBridge;
  }
}
