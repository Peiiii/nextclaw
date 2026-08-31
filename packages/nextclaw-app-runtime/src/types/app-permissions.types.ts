import type { AppPermissions } from "#app-runtime/types/app-manifest.types.js";

export type AppDocumentGrantMap = Record<string, string>;

export type AppStoredDocumentGrant = {
  path: string;
  mode: "read" | "read-write";
  grantedAt: string;
};

export type AppStoredDocumentGrantMap = Record<string, AppStoredDocumentGrant>;

export type ResolvedDocumentGrant = {
  id: string;
  mode: "read" | "read-write";
  description?: string;
  path: string;
};

export type ResolvedPermissions = {
  documentAccess: ResolvedDocumentGrant[];
  allowedDomains: string[];
  storage: {
    enabled: boolean;
    namespace?: string;
  };
  capabilities: {
    hostBridge: boolean;
  };
};

export type AppPermissionSummary = Pick<
  ResolvedPermissions,
  "documentAccess" | "allowedDomains" | "storage" | "capabilities"
> & {
  requested: AppPermissions;
};

export type AppDocumentGrantState = {
  id: string;
  mode: "read" | "read-write";
  description?: string;
  granted: boolean;
  grantedPath?: string;
  effectiveMode?: "read" | "read-write";
  grantedAt?: string;
  status: "ungranted" | "granted" | "insufficient" | "unavailable";
  availableActions: Array<
    "grant" | "replace" | "upgrade" | "downgrade" | "revoke"
  >;
};

export type AppInstalledPermissionState = {
  appId: string;
  name: string;
  activeVersion: string;
  documentAccess: AppDocumentGrantState[];
  allowedDomains: string[];
  storage: {
    enabled: boolean;
    namespace?: string;
  };
  capabilities: {
    hostBridge: boolean;
  };
};

export type AppDocumentGrantMutationResult = {
  appId: string;
  scopeId: string;
  grantedPath?: string;
  effectiveMode?: "read" | "read-write";
  removed?: boolean;
};
