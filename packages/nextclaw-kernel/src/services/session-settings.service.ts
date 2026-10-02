import type { SessionSettingsPatch } from "@kernel/types/session.types.js";
import {
  applySessionProjectMetadataPatch,
  applySessionSettingsMetadataPatch,
} from "@kernel/utils/session-manager.utils.js";
import type { NcpSessionSummary } from "@nextclaw/ncp";

export type SessionSettingsServiceOptions = {
  createSession: (params: {
    sessionId: string;
    sourceSessionMetadata: Record<string, unknown>;
    task: string;
  }) => Promise<unknown>;
  getSession: (sessionId: string) => Promise<NcpSessionSummary | null>;
  normalizeProjectContext: (value: unknown) => Promise<{
    projectId: string;
    rootPath: string;
  } | null>;
  setSessionMetadata: (
    sessionId: string,
    metadata: Record<string, unknown>,
  ) => Promise<boolean>;
};

export class SessionSettingsService {
  private readonly writes = new Map<string, Promise<unknown>>();

  constructor(private readonly options: SessionSettingsServiceOptions) {}

  patch = async (
    sessionId: string,
    patch: SessionSettingsPatch,
    createIfMissing = false,
  ): Promise<NcpSessionSummary | null> => {
    const previous = this.writes.get(sessionId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() =>
      this.patchNow(sessionId, patch, createIfMissing),
    );
    this.writes.set(sessionId, next);
    try {
      return await next;
    } finally {
      if (this.writes.get(sessionId) === next) this.writes.delete(sessionId);
    }
  };

  private patchNow = async (
    sessionId: string,
    patch: SessionSettingsPatch,
    createIfMissing: boolean,
  ): Promise<NcpSessionSummary | null> => {
    let existing = await this.options.getSession(sessionId);
    if (!existing && createIfMissing) {
      await this.options.createSession({
        sessionId,
        sourceSessionMetadata: {},
        task: "Session",
      });
      existing = await this.options.getSession(sessionId);
    }
    if (!existing) return null;
    const metadata = await applySessionProjectMetadataPatch(
      applySessionSettingsMetadataPatch(existing.metadata ?? {}, patch),
      patch,
      this.options.normalizeProjectContext,
    );
    return (await this.options.setSessionMetadata(sessionId, metadata))
      ? await this.options.getSession(sessionId)
      : null;
  };
}
