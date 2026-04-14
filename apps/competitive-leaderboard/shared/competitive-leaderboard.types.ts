export type ProductComparability = "core" | "adjacent" | "watch";

export type ProductCategory =
  | "operating-layer"
  | "personal-assistant"
  | "agent-runtime"
  | "embedded-assistant"
  | "knowledge-assistant"
  | "workspace"
  | "chat-ui"
  | "platform"
  | "suite-assistant"
  | "home-assistant"
  | "wrapper";

export type ConfidenceLevel = "high" | "medium" | "low";

export type EvidenceKind = "fact" | "classification" | "metric";

export type ProductSource = {
  label: string;
  url: string;
  kind: "repo" | "docs" | "site" | "readme";
};

export type CapabilityId =
  | "local-control"
  | "web-or-admin-ui"
  | "multi-channel"
  | "voice"
  | "scheduled-automation"
  | "extensibility"
  | "memory"
  | "task-execution"
  | "deployment-flexibility"
  | "docs-onboarding";

export type CapabilityStatus = "yes" | "partial" | "no";

export type InclusionCriterionId =
  | "assistant-identity"
  | "standalone-entry"
  | "self-hosted-or-local"
  | "action-layer"
  | "official-docs";

export type PublicMetricId = "stars" | "forks" | "activity" | "docs" | "license";

export type ProductProfile = {
  id: string;
  name: string;
  displayName: string;
  category: ProductCategory;
  comparability: ProductComparability;
  disclosure: "nextclaw-owned" | "third-party";
  shortDescription: string;
  positioning: string;
  bestFor: string;
  caution: string;
  highlight: string;
  tags: string[];
  sources: ProductSource[];
};

export type RepoStats = {
  repoFullName: string;
  stars: number;
  forks: number;
  pushedAt: string;
  createdAt: string | null;
  homepage: string | null;
  license: string | null;
};

export type ProductEvidence = {
  id: string;
  productId: string;
  kind: EvidenceKind;
  confidence: ConfidenceLevel;
  sourceTitle: string;
  sourceUrl: string;
  checkedAt: string;
  summary: string;
};

export type InclusionCheck = {
  id: InclusionCriterionId;
  label: string;
  passed: boolean;
  summary: string;
  evidenceIds: string[];
};

export type PublicMetric = {
  id: PublicMetricId;
  label: string;
  rawValue: string;
  points: number;
  maxPoints: number;
  summary: string;
};

export type CapabilityAssessment = {
  id: CapabilityId;
  label: string;
  status: CapabilityStatus;
  points: number;
  maxPoints: number;
  summary: string;
  evidenceIds: string[];
};

export type ScoreBreakdown = {
  publicSignalScore: number;
  capabilityScore: number;
  overallScore: number | null;
};

export type ProductDetail = {
  product: ProductProfile;
  repoStats: RepoStats | null;
  overallScore: number | null;
  rank: number | null;
  inclusionLabel: string;
  notRankedReason: string | null;
  scoreBreakdown: ScoreBreakdown;
  publicMetrics: PublicMetric[];
  inclusionChecks: InclusionCheck[];
  capabilityAssessments: CapabilityAssessment[];
  strengths: string[];
  evidence: ProductEvidence[];
};

export type SpotlightBoardItem = {
  productId: string;
  label: string;
  valueLabel: string;
  score: number;
  comparability: ProductComparability;
};

export type SpotlightBoard = {
  id: string;
  label: string;
  description: string;
  metricLabel: string;
  items: SpotlightBoardItem[];
};

export type LeaderboardMethodology = {
  definition: string;
  inclusionRules: string[];
  tierRules: string[];
  scoringFormula: string[];
  exclusions: string[];
  reviewedExclusions: {
    name: string;
    reason: string;
    sourceTitle: string;
    sourceUrl: string;
  }[];
  notes: string[];
};

export type ChangeLogEntry = {
  date: string;
  summary: string;
};

export type LeaderboardOverview = {
  generatedAt: string;
  methodologyVersion: string;
  summary: {
    totalProducts: number;
    coreComparableCount: number;
    adjacentCount: number;
    watchCount: number;
    rankedCount: number;
    evidenceCount: number;
  };
  disclosures: string[];
  productDetails: ProductDetail[];
  ranking: ProductDetail[];
  spotlightBoards: SpotlightBoard[];
  methodology: LeaderboardMethodology;
  changeLog: ChangeLogEntry[];
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
