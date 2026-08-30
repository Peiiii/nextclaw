import { createHash } from "node:crypto";

export const PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS = [
  "darwin-arm64",
  "windows-x64",
  "linux-x64",
] as const;

export type PortableRuntimeAcceptancePlatform =
  (typeof PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS)[number];

export type PortableRuntimeAcceptanceEvidenceSource = "local" | "ci" | "release";

export type PortableRuntimeAcceptanceDefinition = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  checkerKey: string;
  category: "execution" | "capability" | "lifecycle" | "entry" | "quality" | "release";
  required: boolean;
  scenarioVersion: string;
  evidenceSource: PortableRuntimeAcceptanceEvidenceSource;
  platforms: readonly PortableRuntimeAcceptancePlatform[];
};

const ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS = PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS;

function definition<const Id extends string>(entry: Omit<PortableRuntimeAcceptanceDefinition, "titleKey" | "descriptionKey"> & { id: Id }) {
  return {
    ...entry,
    titleKey: `portableRuntimeAcceptance.${entry.id}.title`,
    descriptionKey: `portableRuntimeAcceptance.${entry.id}.description`,
  };
}

/**
 * The sole machine-readable registry of portable runtime acceptance criteria.
 * Product projections and release tooling consume this value; they must not
 * reconstruct IDs from documents, panels, or test file names.
 */
export const PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT = [
  definition({ id: "PRT-EXEC-001", checkerKey: "portable-runtime.execution", category: "execution", required: true, scenarioVersion: "exec-v1", evidenceSource: "local", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-DATA-001", checkerKey: "portable-runtime.data", category: "capability", required: true, scenarioVersion: "data-v1", evidenceSource: "local", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-FILE-001", checkerKey: "portable-runtime.files", category: "capability", required: true, scenarioVersion: "file-v1", evidenceSource: "local", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-NET-001", checkerKey: "portable-runtime.network", category: "capability", required: true, scenarioVersion: "net-v1", evidenceSource: "local", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-SECRET-001", checkerKey: "portable-runtime.secrets", category: "capability", required: true, scenarioVersion: "secret-v1", evidenceSource: "local", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-RES-001", checkerKey: "portable-runtime.resident", category: "lifecycle", required: true, scenarioVersion: "resident-v1", evidenceSource: "local", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-EVENT-001", checkerKey: "portable-runtime.events", category: "lifecycle", required: true, scenarioVersion: "event-v1", evidenceSource: "local", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-TASK-001", checkerKey: "portable-runtime.tasks", category: "lifecycle", required: true, scenarioVersion: "task-v1", evidenceSource: "local", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-STREAM-001", checkerKey: "portable-runtime.streams", category: "capability", required: true, scenarioVersion: "stream-v1", evidenceSource: "local", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-AGENT-001", checkerKey: "portable-runtime.agent", category: "entry", required: true, scenarioVersion: "agent-v1", evidenceSource: "local", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-AI-001", checkerKey: "portable-runtime.ai", category: "capability", required: true, scenarioVersion: "ai-v1", evidenceSource: "local", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-COMP-001", checkerKey: "portable-runtime.components", category: "capability", required: true, scenarioVersion: "component-v1", evidenceSource: "local", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-ENTRY-001", checkerKey: "portable-runtime.entry", category: "entry", required: true, scenarioVersion: "entry-v1", evidenceSource: "local", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-LIFE-001", checkerKey: "portable-runtime.lifecycle", category: "lifecycle", required: true, scenarioVersion: "lifecycle-v1", evidenceSource: "local", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-BOUND-001", checkerKey: "portable-runtime.boundaries", category: "quality", required: true, scenarioVersion: "boundaries-v1", evidenceSource: "local", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-PERF-001", checkerKey: "portable-runtime.performance", category: "quality", required: true, scenarioVersion: "performance-v1", evidenceSource: "ci", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-DX-001", checkerKey: "portable-runtime.developer-experience", category: "quality", required: true, scenarioVersion: "developer-experience-v1", evidenceSource: "ci", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-DIST-001", checkerKey: "portable-runtime.distribution", category: "quality", required: true, scenarioVersion: "distribution-v1", evidenceSource: "ci", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-EVID-001", checkerKey: "portable-runtime.evidence", category: "quality", required: true, scenarioVersion: "evidence-v1", evidenceSource: "local", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-REF-001", checkerKey: "portable-runtime.reference-app", category: "quality", required: true, scenarioVersion: "reference-app-v1", evidenceSource: "ci", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-DOCS-001", checkerKey: "portable-runtime.documentation", category: "quality", required: true, scenarioVersion: "documentation-v1", evidenceSource: "ci", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
  definition({ id: "PRT-REL-001", checkerKey: "portable-runtime.release", category: "release", required: true, scenarioVersion: "release-v1", evidenceSource: "release", platforms: ALL_PORTABLE_RUNTIME_ACCEPTANCE_PLATFORMS }),
] as const satisfies readonly PortableRuntimeAcceptanceDefinition[];

export type PortableRuntimeAcceptanceId =
  (typeof PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT)[number]["id"];

export const PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT = `sha256:${createHash("sha256")
  .update(JSON.stringify(PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT))
  .digest("hex")}`;
