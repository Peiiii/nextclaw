export type WireApiMode = "auto" | "chat" | "responses";
export type ProviderApiProtocol = "openai-compatible" | "anthropic-messages";

export type LocalizedText = {
  en?: string;
  zh?: string;
};

export type ProviderDeviceCodeAuthProtocol = "rfc8628" | "minimax_user_code";

export type ProviderDeviceCodeAuthMethodSpec = {
  id: string;
  label?: LocalizedText;
  hint?: LocalizedText;
  baseUrl?: string;
  deviceCodePath?: string;
  tokenPath?: string;
  clientId?: string;
  scope?: string;
  grantType?: string;
  usePkce?: boolean;
  defaultApiBase?: string;
};

export type ProviderDeviceCodeAuthSpec = {
  kind: "device_code";
  protocol?: ProviderDeviceCodeAuthProtocol;
  displayName?: string;
  baseUrl: string;
  deviceCodePath: string;
  tokenPath: string;
  clientId: string;
  scope: string;
  grantType: string;
  usePkce?: boolean;
  methods?: ProviderDeviceCodeAuthMethodSpec[];
  defaultMethodId?: string;
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
  apiProtocol?: ProviderApiProtocol;
  modelPrefix?: string;
  defaultModels?: string[];
  visionModels?: string[];
  defaultHeaders?: Record<string, string>;
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
  supportsResponsesApi?: boolean;
  logo?: string;
  apiBaseHelp?: LocalizedText;
  auth?: ProviderAuthSpec;
};

export type ProviderCatalogPlugin = {
  id: string;
  providers: ProviderSpec[];
};
