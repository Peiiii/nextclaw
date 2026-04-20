import type { LlmProviderId } from "./entity-ids.types.js";

export type LlmProviderRecord = {
  id: LlmProviderId;
  name: string;
  modelIds: string[];
  enabled: boolean;
  metadata: Record<string, unknown>;
};
