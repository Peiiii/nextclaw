import type { EffectiveAgentProfile } from "@nextclaw/core";
import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import {
  NextclawHarnessError,
  type INextclawAgent,
  type INextclawAgentRegistry,
  type INextclawAgentSessions,
  type NextclawAgentDefinition,
} from "@kernel/features/harness/types/nextclaw-harness.types.js";

function toAgentDefinition(
  profile: EffectiveAgentProfile,
): NextclawAgentDefinition {
  return {
    id: profile.id,
    ...(profile.displayName ? { displayName: profile.displayName } : {}),
    ...(profile.description ? { description: profile.description } : {}),
    ...(profile.model ? { model: profile.model } : {}),
    ...(profile.runtime ? { runtime: profile.runtime } : {}),
    ...(profile.runtimeConfig
      ? { runtimeConfig: structuredClone(profile.runtimeConfig) }
      : {}),
  };
}

class NextclawAgent implements INextclawAgent {
  readonly id: string;

  constructor(
    readonly definition: NextclawAgentDefinition,
    readonly sessions: INextclawAgentSessions,
  ) {
    this.id = definition.id;
  }
}

export class NextclawAgentRegistry implements INextclawAgentRegistry {
  constructor(
    private readonly requireKernel: () => NextclawKernel,
    private readonly getAgentSessions: (
      agentId: string,
    ) => INextclawAgentSessions,
  ) {}

  create = async (
    definition: NextclawAgentDefinition,
  ): Promise<INextclawAgent> => {
    try {
      const profile = await this.requireKernel().agents.createAgent(definition);
      return this.createHandle(profile);
    } catch (error) {
      throw new NextclawHarnessError(
        "invalid_input",
        error instanceof Error ? error.message : String(error),
        error,
      );
    }
  };

  get = (agentId?: string): INextclawAgent => {
    const agents = this.requireKernel().agents;
    const resolvedId = agentId?.trim() || agents.getDefaultAgentId();
    const profile = agents.getAgent(resolvedId);
    if (!profile) {
      throw new NextclawHarnessError(
        "invalid_input",
        `Agent was not found: ${resolvedId}`,
      );
    }
    return this.createHandle(profile);
  };

  list = (): NextclawAgentDefinition[] =>
    this.requireKernel().agents.listAgents().map(toAgentDefinition);

  private createHandle = (profile: EffectiveAgentProfile): INextclawAgent =>
    new NextclawAgent(
      toAgentDefinition(profile),
      this.getAgentSessions(profile.id),
    );
}
