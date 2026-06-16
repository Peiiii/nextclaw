export type PreferenceJsonValue =
  | null
  | boolean
  | number
  | string
  | PreferenceJsonValue[]
  | { [key: string]: PreferenceJsonValue };

export type PreferenceEntry = {
  key: string;
  value: PreferenceJsonValue;
  updatedAt: string;
};
