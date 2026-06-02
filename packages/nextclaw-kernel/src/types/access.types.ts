export type AccessRole = "admin";

export type AccessPrincipal = {
  id: string;
  role: AccessRole;
};

export type AccessSessionRecord = {
  tokenHash: string;
  principal: AccessPrincipal;
  createdAt: string;
  expiresAt: string;
};

export type AccessSessionState = {
  kind: "nextclaw.access.sessions";
  version: 1;
  sessions: AccessSessionRecord[];
};

export type AccessPasswordStatus = {
  enabled: boolean;
  configured: boolean;
  authenticated: boolean;
  username?: string;
};

export type AccessLoginResult = {
  status: AccessPasswordStatus;
  token?: string;
  expiresAt?: string;
};
