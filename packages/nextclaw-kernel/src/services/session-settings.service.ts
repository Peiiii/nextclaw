import type { SessionSettingsPatch } from "@kernel/types/session.types.js";
import {
  applySessionProjectMetadataPatch,
  applySessionSettingsMetadataPatch,
} from "@kernel/utils/session-manager.utils.js";
import type { NcpSessionSummary } from "@nextclaw/ncp";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";

export type SessionSettingsServiceOptions = {
  createSession: (params: {
    sessionId: string;
    sourceSessionMetadata: Record<string, unknown>;
    task: string;
  }) => Promise<unknown>;
  getSession: (sessionId: string) => Promise<NcpSessionSummary | null>;
  getSessionRecord: (sessionId: string) => Promise<AgentSessionRecord | null>;
  normalizeProjectRoot: (value: unknown) => Promise<string | null>;
  setSessionMetadata: (
    sessionId: string,
    metadata: Record<string, unknown>,
  ) => Promise<boolean>;
};

export class SessionSettingsService {
  constructor(private readonly options: SessionSettingsServiceOptions) {}

  patch = async (
    sessionId: string,
    patch: SessionSettingsPatch,
    createIfMissing = false,
  ): Promise<NcpSessionSummary | null> => {
    let existing = await this.options.getSessionRecord(sessionId);
    if (!existing && createIfMissing) {
      await this.options.createSession({
        sessionId,
        sourceSessionMetadata: {},
        task: "Session",
      });
      existing = await this.options.getSessionRecord(sessionId);
    }
    if (!existing) return null;
    const metadata = await applySessionProjectMetadataPatch(
      applySessionSettingsMetadataPatch(existing.metadata ?? {}, patch),
      patch,
      this.options.normalizeProjectRoot,
    );
    return (await this.options.setSessionMetadata(sessionId, metadata))
      ? await this.options.getSession(sessionId)
      : null;
  };
}
