export type AuthStatusView = {
  enabled: boolean;
  configured: boolean;
  authenticated: boolean;
  username?: string;
};

export type AuthSetupRequest = {
  username: string;
  password: string;
};

export type AuthLoginRequest = {
  username: string;
  password: string;
};

export type AuthPasswordUpdateRequest = {
  password: string;
};

export type AuthEnabledUpdateRequest = {
  enabled: boolean;
};
