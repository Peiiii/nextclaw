type D1BindValue = string | number | null;

export type D1RunResult = {
  success: boolean;
  meta?: Record<string, unknown>;
};

export type D1AllResult<T> = {
  results: T[];
};

export type D1PreparedStatement = {
  bind: (...values: D1BindValue[]) => D1PreparedStatement;
  run: () => Promise<D1RunResult>;
  all: <T>() => Promise<D1AllResult<T>>;
  first: <T>() => Promise<T | null>;
};

export type D1Database = {
  prepare: (query: string) => D1PreparedStatement;
  batch?: (statements: D1PreparedStatement[]) => Promise<unknown>;
};

export type PortalAssetsBinding = {
  fetch: (request: Request) => Promise<Response>;
};

export type PortalWorkerEnv = {
  SUPPORT_PLATFORM_API_BASE?: string;
  SUPPORT_MAINTAINER_TOKEN?: string;
  SUPPORT_ADMIN_TOKEN?: string;
  SUPPORT_MAX_AUTHORITY?: "analyze" | "repair" | "deliver";
  SUPPORT_PAUSED?: string;
  SUPPORT_GITHUB_REPOSITORY?: string;
  SUPPORT_GITHUB_TOKEN?: string;
  ASSETS?: PortalAssetsBinding;
  PUBLIC_ROADMAP_PORTAL_DB?: D1Database;
  PUBLIC_ROADMAP_FEEDBACK_PORTAL_DATA_MODE?: string;
  PUBLIC_ROADMAP_FEEDBACK_PORTAL_INTERNAL_TOKEN?: string;
  PUBLIC_ROADMAP_FEEDBACK_PORTAL_LINEAR_API_URL?: string;
  PUBLIC_ROADMAP_FEEDBACK_PORTAL_LINEAR_AUTH_MODE?: string;
  PUBLIC_ROADMAP_FEEDBACK_PORTAL_LINEAR_TEAM_KEY?: string;
  PUBLIC_ROADMAP_FEEDBACK_PORTAL_LINEAR_PUBLIC_LABELS?: string;
  PUBLIC_ROADMAP_FEEDBACK_PORTAL_LINEAR_FEATURE_LABELS?: string;
  PUBLIC_ROADMAP_FEEDBACK_PORTAL_LINEAR_BUG_LABELS?: string;
  PUBLIC_ROADMAP_FEEDBACK_PORTAL_LINEAR_IMPROVEMENT_LABELS?: string;
  PUBLIC_ROADMAP_FEEDBACK_PORTAL_LINEAR_RESEARCH_LABELS?: string;
  LINEAR_API_TOKEN?: string;
};
