declare global {
  interface Window {
    nextclawCompanion: {
      open: () => Promise<void>;
      quit: () => Promise<void>;
      getBootstrap: () => Promise<{ baseUrl: string }>;
    };
  }
}

export {};
