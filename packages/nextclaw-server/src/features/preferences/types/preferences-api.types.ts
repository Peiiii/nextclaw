import type { PreferenceJsonValue } from "@nextclaw/kernel";

export type PreferenceEntryView = {
  key: string;
  value: PreferenceJsonValue | null;
  updatedAt?: string;
};

export type PreferenceUpdateRequest = {
  value: PreferenceJsonValue;
};

export type PreferenceDeleteResult = {
  key: string;
  deleted: boolean;
};
