export type WireApiMode = "auto" | "chat" | "responses";

export type LocalizedText = {
  en?: string;
  zh?: string;
};

export type ProviderDeviceCodeAuthSpec = {
  kind: "device_code";
  displayName?: string;
  baseUrl: string;
  deviceCodePath: string;
  tokenPath: string;
  clientId: string;
  scope: string;
  grantType: string;
  usePkce?: boolean;
  note?: LocalizedText;
  cliCredential?: {
    path: string;
    accessTokenField: string;
    refreshTokenField?: string;
    expiresAtField?: string;
  };
};

export type ProviderAuthSpec = ProviderDeviceCodeAuthSpec;

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
  auth?: ProviderAuthSpec;
};

export type ProviderCatalogPlugin = {
  id: string;
  providers: ProviderSpec[];
};
