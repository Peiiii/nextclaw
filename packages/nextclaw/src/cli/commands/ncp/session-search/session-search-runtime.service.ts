import type { SessionManager } from "@nextclaw/core";
import type { NcpTool } from "@nextclaw/ncp";
import { NextclawAgentSessionStore } from "../nextclaw-agent-session-store.js";
import { SessionSearchFeatureService } from "./session-search-feature.service.js";
import { SessionSearchUnsupportedRuntimeError } from "./session-search-store.service.js";

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type SessionSearchFeatureLike = Pick<
  SessionSearchFeatureService,
  "initialize" | "createTool" | "handleSessionUpdated" | "dispose"
>;

export class SessionSearchRuntimeSupport {
  private readonly feature: SessionSearchFeatureLike;
  private enabled = true;

  constructor(
    params: {
      sessionManager: SessionManager;
      onSessionUpdated?: (sessionKey: string) => void;
      databasePath: string;
      feature?: SessionSearchFeatureLike;
    },
  ) {
    this.onSessionUpdated = params.onSessionUpdated;
    this.feature =
      params.feature ??
      new SessionSearchFeatureService({
        sessionStore: new NextclawAgentSessionStore(params.sessionManager),
        databasePath: params.databasePath,
      });
  }

  private readonly onSessionUpdated?: (sessionKey: string) => void;

  initialize = async (): Promise<void> => {
    try {
      await this.feature.initialize();
    } catch (error) {
      if (error instanceof SessionSearchUnsupportedRuntimeError) {
        this.enabled = false;
        console.warn(`[session-search] Disabled: ${formatErrorMessage(error)}`);
        return;
      }
      throw error;
    }
  };

  createAdditionalTools = (params: { currentSessionId?: string }): NcpTool[] =>
    this.enabled ? [this.feature.createTool(params)] : [];

  handleSessionUpdated = (sessionKey: string): void => {
    this.onSessionUpdated?.(sessionKey);
    if (!this.enabled) {
      return;
    }
    void this.feature.handleSessionUpdated(sessionKey).catch((error) => {
      console.warn(`[session-search] Failed to update ${sessionKey}: ${formatErrorMessage(error)}`);
    });
  };

  dispose = async (): Promise<void> => {
    if (!this.enabled) {
      return;
    }
    await this.feature.dispose();
  };
}
