export type AppCheckSeverity = "error" | "warning";
export type AppCheckKind = "mixed" | "panel" | "service" | "unknown";

export type AppCheckIssue = {
  severity: AppCheckSeverity;
  code: string;
  message: string;
  fixHint?: string;
};

export type AppCheckReport = {
  ok: boolean;
  kind: AppCheckKind;
  target: string;
  issues: AppCheckIssue[];
};

export type AppCheckCommandOptions = {
  json?: boolean;
};

export type JsonRecord = Record<string, unknown>;
