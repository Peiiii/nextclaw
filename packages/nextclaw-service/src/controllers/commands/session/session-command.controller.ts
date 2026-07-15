import type { NextclawKernel } from "@nextclaw/kernel";

export type SessionCommandOptions = {
  json?: boolean;
};

export class SessionCommands {
  constructor(private readonly createKernel: () => NextclawKernel) {}

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

  private update = async (
    sessionId: string,
    patch: { label?: string; projectRoot?: string | null },
    options: SessionCommandOptions,
  ): Promise<void> => {
    const kernel = this.createKernel();
    try {
      const session = await kernel.sessionManager.patchSessionSettings(sessionId, patch);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      console.log(options.json
        ? JSON.stringify(session, null, 2)
        : `Updated session ${session.sessionId}`);
    } finally {
      await kernel.dispose();
    }
  };
}
