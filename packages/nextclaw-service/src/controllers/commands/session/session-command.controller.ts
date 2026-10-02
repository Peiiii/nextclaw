import type { createNextclawApplication } from "@nextclaw/harness";

export type SessionCommandOptions = {
  json?: boolean;
};

export type SessionDeleteCommandOptions = SessionCommandOptions & {
  confirm: string;
};

export class SessionCommands {
  constructor(private readonly createKernel: typeof createNextclawApplication) {}

  rename = async (
    sessionId: string,
    label: string,
    options: SessionCommandOptions = {},
  ): Promise<void> => {
    await this.update(sessionId, { label }, options);
  };

  setProject = async (
    sessionId: string,
    projectRoot: string,
    options: SessionCommandOptions = {},
  ): Promise<void> => {
    await this.update(sessionId, { projectRoot }, options);
  };

  clearProject = async (
    sessionId: string,
    options: SessionCommandOptions = {},
  ): Promise<void> => {
    await this.update(sessionId, { projectRoot: null }, options);
  };

  setPinned = async (sessionId: string, pinned: boolean, options: SessionCommandOptions = {}): Promise<void> => {
    await this.update(sessionId, { pinned }, options);
  };

  delete = async (
    sessionId: string,
    options: SessionDeleteCommandOptions,
  ): Promise<void> => {
    if (options.confirm !== sessionId) {
      throw new Error(`--confirm must exactly match the session id: ${sessionId}`);
    }
    const { kernel, harness } = await this.createKernel();
    try {
      const session = await kernel.sessionManager.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      kernel.sessionRunManager.deleteSessionRun(sessionId);
      await kernel.sessionManager.deleteSession(sessionId);
      const result = { deleted: true, sessionId };
      console.log(options.json
        ? JSON.stringify(result, null, 2)
        : `Deleted session ${sessionId}`);
    } finally {
      await harness.dispose();
    }
  };

  private update = async (
    sessionId: string,
    patch: { label?: string; projectRoot?: string | null; pinned?: boolean },
    options: SessionCommandOptions,
  ): Promise<void> => {
    const { kernel, harness } = await this.createKernel();
    try {
      const session = await kernel.sessionManager.patchSessionSettings(sessionId, patch);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      console.log(options.json
        ? JSON.stringify(session, null, 2)
        : `Updated session ${session.sessionId}`);
    } finally {
      await harness.dispose();
    }
  };
}
