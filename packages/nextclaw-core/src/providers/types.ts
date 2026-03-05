export type WireApiMode = "auto" | "chat" | "responses";

export type LocalizedText = {
  en?: string;
  zh?: string;
};

export type ProviderSpec = {
  name: string;
  keywords: string[];
  envKey: string;
  displayName?: string;
  modelPrefix?: string;
  defaultModels?: string[];
  litellmPrefix?: string;
  skipPrefixes?: string[];
  envExtras?: Array<[string, string]>;
  isGateway?: boolean;
  isLocal?: boolean;
  detectByKeyPrefix?: string;
  detectByBaseKeyword?: string;
  defaultApiBase?: string;
  stripModelPrefix?: boolean;
  modelOverrides?: Array<[string, Record<string, unknown>]>;
  supportsWireApi?: boolean;
  wireApiOptions?: WireApiMode[];
  defaultWireApi?: WireApiMode;
  logo?: string;
  apiBaseHelp?: LocalizedText;
};

export type ProviderCatalogPlugin = {
  id: string;
  providers: ProviderSpec[];
};
