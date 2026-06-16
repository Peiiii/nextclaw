export type PreferenceJsonValue =
  | null
  | boolean
  | number
  | string
  | PreferenceJsonValue[]
  | { [key: string]: PreferenceJsonValue };

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
