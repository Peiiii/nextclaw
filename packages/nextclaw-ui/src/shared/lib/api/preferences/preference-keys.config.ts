export const PREFERENCE_KEYS = {
  chat: {
    modelFavorites: "chat.modelFavorites",
    newSessionType: "chat.newSession.sessionType",
  },
} as const;

export type PreferenceKey =
  (typeof PREFERENCE_KEYS.chat)[keyof typeof PREFERENCE_KEYS.chat];
