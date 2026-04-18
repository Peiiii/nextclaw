import type { AppPermissions } from "../manifest/app-manifest.types.js";

export type AppDocumentGrantMap = Record<string, string>;

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
  removed?: boolean;
};
