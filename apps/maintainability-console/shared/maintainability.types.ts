export type MaintainabilityProfile = "source" | "repo-volume";

export type MetricTotals = {
  files: number;
  totalLines: number;
  blankLines: number;
  commentLines: number;
  codeLines: number;
};

export type BreakdownMetricRow = MetricTotals & {
  name: string;
  sharePercent: number;
  averageCodeLinesPerFile: number;
};

export type FileMetricRow = MetricTotals & {
  path: string;
  scope: string;
  language: string;
  sharePercent: number;
};

export type DirectoryBudgetHotspot = {
  level: "warn" | "error";
  path: string;
  message: string;
  budget: string;
  currentCount: number;
  previousCount: number | null;
  deltaCount: number | null;
  exceptionPath: string | null;
  exceptionReason: string | null;
  exceptionStatus: "complete" | "incomplete" | "missing";
};

export type MaintainabilityHotspotRow = {
  chain: string;
  path: string;
  rationale: string;
  nextSplitSeam: string;
  allowedAdditions: string[];
  prohibitedAdditions: string[];
  currentLines: number | null;
  codeLines: number | null;
  scope: string | null;
};

export type GovernanceRuleSection = "rulebook" | "project-rulebook";

export type GovernanceRule = {
  name: string;
  section: GovernanceRuleSection;
  sectionLabel: string;
  constraint: string;
  example: string;
  counterExample: string;
  execution: string;
  owner: string;
  isComplete: boolean;
};

export type GovernanceRuleSectionSummary = {
  section: GovernanceRuleSection;
  label: string;
  count: number;
  completeCount: number;
};

export type GovernanceRuleOwnerSummary = {
  owner: string;
  count: number;
  generalRuleCount: number;
  projectRuleCount: number;
};

export type GovernanceRulebookOverview = {
  sourcePath: string;
  totalCount: number;
  completeCount: number;
  sectionSummaries: GovernanceRuleSectionSummary[];
  ownerSummaries: GovernanceRuleOwnerSummary[];
  rules: GovernanceRule[];
};

export type MaintainabilityDeliveryMode = "live-scan" | "published-snapshot";

export type MaintainabilityOverview = {
  generatedAt: string;
  durationMs: number;
  repoRoot: string;
  profile: MaintainabilityProfile;
  deliveryMode: MaintainabilityDeliveryMode;
  git: {
    sha: string | null;
    ref: string | null;
  };
  summary: {
    moduleCount: number;
    languageCount: number;
    directoryHotspotCount: number;
    maintainabilityHotspotCount: number;
    scanRootCount: number;
    governanceRuleCount: number;
    projectRuleCount: number;
    governanceOwnerCount: number;
  };
  scope: {
    includePaths: string[];
    includeExtensions: string[];
    excludeDirs: string[];
  };
  totals: MetricTotals;
  byScope: BreakdownMetricRow[];
  byLanguage: BreakdownMetricRow[];
  largestFiles: FileMetricRow[];
  directoryHotspots: DirectoryBudgetHotspot[];
  maintainabilityHotspots: MaintainabilityHotspotRow[];
  governanceRulebook: GovernanceRulebookOverview;
};

export type ApiEnvelope<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };
