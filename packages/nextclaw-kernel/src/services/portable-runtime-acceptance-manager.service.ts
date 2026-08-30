import {
  PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT,
  PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT,
  type PortableRuntimeAcceptanceDefinition,
} from "@kernel/types/portable-runtime-acceptance.types.js";
import {
  evaluatePortableRuntimeAcceptance,
  type PortableRuntimeAcceptanceEvidence,
  type PortableRuntimeAcceptanceResult,
  type PortableRuntimeAcceptanceResultStatus,
} from "@kernel/utils/portable-runtime-acceptance-evaluator.utils.js";
import {
  presentPortableRuntimeAcceptanceDefinition,
  resolvePortableRuntimeAcceptanceLocale,
  type PortableRuntimeAcceptanceLocale,
  type PortableRuntimeAcceptancePresentation,
} from "@kernel/utils/portable-runtime-acceptance-presentation.utils.js";
import type {
  PortableRuntimeAcceptanceIdentityService,
  PortableRuntimeAcceptanceIdentityResult,
} from "@kernel/services/portable-runtime-acceptance-identity.service.js";
import type {
  PortableRuntimeAcceptancePlatform,
} from "@kernel/types/portable-runtime-acceptance.types.js";
import type { VerificationEvidenceRecord } from "@kernel/types/verification-record.types.js";
import type { VerificationRecordService } from "@kernel/services/verification-record.service.js";

/** The fixed installed App used for the canonical portable-runtime acceptance matrix. */
export const PORTABLE_RUNTIME_ACCEPTANCE_REFERENCE_APP_ID = "nextclaw.github-issue-watcher";

export type PortableRuntimeAcceptanceContractView = {
  contractFingerprint: string;
  locale: PortableRuntimeAcceptanceLocale;
  definitions: PortableRuntimeAcceptanceDefinitionView[];
};

export type PortableRuntimeAcceptanceDefinitionView = PortableRuntimeAcceptanceDefinition & {
  presentation: PortableRuntimeAcceptancePresentation;
};

/**
 * The evaluator always has a concrete platform. Product status additionally
 * represents an unavailable identity, where the host may itself be unknown.
 */
export type PortableRuntimeAcceptanceSurfaceResult = Omit<PortableRuntimeAcceptanceResult, "environment"> & {
  environment: PortableRuntimeAcceptancePlatform | null;
};

export type PortableRuntimeAcceptanceStatusEntry = PortableRuntimeAcceptanceDefinitionView & {
  result: PortableRuntimeAcceptanceSurfaceResult;
};

export type PortableRuntimeAcceptanceStatusView = {
  schemaVersion: 1;
  contract: PortableRuntimeAcceptanceContractView;
  appId: string;
  identity: PortableRuntimeAcceptanceIdentityResult;
  entries: PortableRuntimeAcceptanceStatusEntry[];
  summary: Record<PortableRuntimeAcceptanceResultStatus, number>;
};

/**
 * Read-only product projection over the single contract registry and durable
 * records. No Panel, API route, or CLI command computes an acceptance state.
 */
export class PortableRuntimeAcceptanceManager {
  constructor(private readonly params: {
    verificationRecords: VerificationRecordService;
    identity: PortableRuntimeAcceptanceIdentityService;
    /** Test-only injection keeps the production source the canonical registry. */
    definitions?: readonly PortableRuntimeAcceptanceDefinition[];
  }) {}

  private get definitions(): readonly PortableRuntimeAcceptanceDefinition[] {
    return this.params.definitions ?? PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT;
  }

  contract = (locale?: unknown): PortableRuntimeAcceptanceContractView => {
    const resolvedLocale = resolvePortableRuntimeAcceptanceLocale(locale);
    return {
      contractFingerprint: PORTABLE_RUNTIME_ACCEPTANCE_CONTRACT_FINGERPRINT,
      locale: resolvedLocale,
      definitions: this.definitions.map((definition) => this.present(definition, resolvedLocale)),
    };
  };

  status = async (params: { appId?: string; locale?: unknown } = {}): Promise<PortableRuntimeAcceptanceStatusView> => {
    const appId = params.appId?.trim() || PORTABLE_RUNTIME_ACCEPTANCE_REFERENCE_APP_ID;
    const contract = this.contract(params.locale);
    const [identity, recordList] = await Promise.all([
      this.params.identity.resolve(appId),
      this.params.verificationRecords.list({ appId, limit: 500 }),
    ]);
    const results = identity.available
      ? evaluatePortableRuntimeAcceptance({
        context: identity.context,
        evidence: this.groupEvidence(recordList.entries),
        definitions: this.definitions,
      })
      : this.unavailableResults(recordList.entries, identity.environment);
    const entries = contract.definitions.map((definition, index) => ({
      ...definition,
      result: results[index]!,
    }));
    const summary: Record<PortableRuntimeAcceptanceResultStatus, number> = {
      "current-passed": 0,
      missing: 0,
      stale: 0,
      failed: 0,
      "not-applicable": 0,
    };
    for (const entry of entries) summary[entry.result.status] += 1;
    return { schemaVersion: 1, contract, appId, identity, entries, summary };
  };

  export = async (params: { appId?: string; locale?: unknown } = {}): Promise<PortableRuntimeAcceptanceStatusView> =>
    await this.status(params);

  private present = (
    definition: PortableRuntimeAcceptanceDefinition,
    locale: PortableRuntimeAcceptanceLocale,
  ): PortableRuntimeAcceptanceDefinitionView => ({
    ...definition,
    platforms: [...definition.platforms],
    presentation: presentPortableRuntimeAcceptanceDefinition(definition, locale),
  });

  private groupEvidence = (records: readonly VerificationEvidenceRecord[]): PortableRuntimeAcceptanceEvidence[] =>
    (["local", "ci", "release"] as const).map((source) => ({
      source,
      // v1 predates provenance. It remains historical local evidence so it
      // is displayed as stale rather than silently discarded.
      records: records.filter((record) => record.evidenceSchemaVersion === 1
        ? source === "local"
        : record.evidenceSource === source),
    } satisfies PortableRuntimeAcceptanceEvidence));

  private unavailableResults = (
    records: readonly VerificationEvidenceRecord[],
    environment: PortableRuntimeAcceptancePlatform | null,
  ): PortableRuntimeAcceptanceSurfaceResult[] =>
    this.definitions.map((definition) => {
      const matching = records.filter((record) => record.acceptanceId === definition.id);
      const latestRecord = matching.sort((left, right) =>
        right.finishedAt.localeCompare(left.finishedAt) || right.verificationRunId.localeCompare(left.verificationRunId),
      )[0];
      return {
        acceptanceId: definition.id,
        required: definition.required,
        environment,
        status: latestRecord ? "stale" : "missing",
        ...(latestRecord ? { latestRecord } : {}),
      };
    });
}
