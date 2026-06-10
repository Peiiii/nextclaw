export type ConfigActionType = "httpProbe" | "oauthStart" | "webhookVerify" | "openUrl" | "copyToken";

export type ConfigActionTrigger = "manual" | "afterSave";

export type ConfigActionPolicy = {
  roles?: string[];
  rateLimitKey?: string;
  cooldownMs?: number;
  audit?: boolean;
};

export type ConfigActionRequest = {
  method: "GET" | "POST" | "PUT";
  path: string;
  timeoutMs?: number;
};

export type ConfigActionResultRule = {
  message?: string;
};

export type ConfigActionManifest = {
  id: string;
  version: string;
  scope: string;
  title: string;
  description?: string;
  type: ConfigActionType;
  trigger: ConfigActionTrigger;
  requires?: string[];
  request: ConfigActionRequest;
  success?: ConfigActionResultRule;
  failure?: ConfigActionResultRule;
  saveBeforeRun?: boolean;
  savePatch?: Record<string, unknown>;
  resultMap?: Record<string, string>;
  policy?: ConfigActionPolicy;
};

export type ConfigActionExecuteRequest = {
  scope?: string;
  draftConfig?: Record<string, unknown>;
  context?: {
    actor?: string;
    traceId?: string;
  };
};

export type ConfigActionExecuteResult = {
  ok: boolean;
  status: "success" | "failed";
  message: string;
  data?: Record<string, unknown>;
  patch?: Record<string, unknown>;
  nextActions?: string[];
};

const FEISHU_VERIFY_ACTION: ConfigActionManifest = {
  id: "channels.feishu.verifyConnection",
  version: "1",
  scope: "channels.feishu",
  title: "Save & Verify / Connect",
  description: "Save credentials and verify Feishu bot connectivity.",
  type: "httpProbe",
  trigger: "manual",
  requires: ["channels.feishu.appId", "channels.feishu.appSecret"],
  request: {
    method: "POST",
    path: "/api/channels/feishu/probe",
    timeoutMs: 12000
  },
  success: {
    message: "Verified. Please finish Feishu event subscription and app publishing before using."
  },
  failure: {
    message: "Verification failed"
  },
  saveBeforeRun: true,
  savePatch: {
    enabled: true
  },
  resultMap: {
    "channels.feishu.status.botName": "response.data.botName",
    "channels.feishu.status.botOpenId": "response.data.botOpenId"
  },
  policy: {
    roles: ["admin"],
    rateLimitKey: "channels.feishu.verifyConnection",
    cooldownMs: 5000,
    audit: true
  }
};

export function buildConfigActions(): ConfigActionManifest[] {
  return [FEISHU_VERIFY_ACTION];
}
