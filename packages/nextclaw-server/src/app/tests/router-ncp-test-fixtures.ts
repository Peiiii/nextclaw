import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  ProjectError,
  ProjectManager,
  type SessionSettingsPatch,
} from "@nextclaw/kernel";
import type { NcpSessionSummary } from "@nextclaw/ncp";

type ReadSession = (sessionId: string) => Promise<NcpSessionSummary | null>;

function hasPatchField(
  patch: SessionSettingsPatch,
  field: keyof SessionSettingsPatch,
): boolean {
  return Object.prototype.hasOwnProperty.call(patch, field);
}

function setOptionalMetadataValue(
  metadata: Record<string, unknown>,
  key: string,
  value: string | null | undefined,
): Record<string, unknown> {
  const normalized = value?.trim();
  if (normalized) {
    return { ...metadata, [key]: normalized };
  }
  const nextMetadata = { ...metadata };
  delete nextMetadata[key];
  return nextMetadata;
}

export class RouterNcpSessionSettingsStub {
  constructor(
    private readonly sessionMetadata: Map<string, Record<string, unknown>>,
    private readonly readSession: ReadSession,
  ) {}

  patchSessionSettings = async (
    sessionId: string,
    patch: SessionSettingsPatch,
    options: { createIfMissing?: boolean } = {},
  ): Promise<NcpSessionSummary | null> => {
    let existing = await this.readSession(sessionId);
    if (!existing && options.createIfMissing) {
      this.sessionMetadata.set(sessionId, {});
      existing = await this.readSession(sessionId);
    }
    if (!existing) {
      return null;
    }
    let metadata = structuredClone(this.sessionMetadata.get(sessionId) ?? {});
    metadata = this.applyPreferencePatch(metadata, patch);
    metadata = this.applyRuntimePatch(metadata, patch);
    this.applyProjectPatch(metadata, patch);
    this.sessionMetadata.set(sessionId, metadata);
    return await this.readSession(sessionId);
  };

  private applyPreferencePatch = (
    metadata: Record<string, unknown>,
    patch: SessionSettingsPatch,
  ): Record<string, unknown> => {
    let nextMetadata = metadata;
    if (hasPatchField(patch, "preferredModel")) {
      nextMetadata = setOptionalMetadataValue(nextMetadata, "preferred_model", patch.preferredModel);
      nextMetadata = setOptionalMetadataValue(nextMetadata, "model", patch.preferredModel);
    }
    if (hasPatchField(patch, "preferredThinking")) {
      nextMetadata = setOptionalMetadataValue(
        nextMetadata,
        "preferred_thinking",
        patch.preferredThinking,
      );
    }
    if (hasPatchField(patch, "label")) {
      nextMetadata = setOptionalMetadataValue(nextMetadata, "label", patch.label);
    }
    return nextMetadata;
  };

  private applyRuntimePatch = (
    metadata: Record<string, unknown>,
    patch: SessionSettingsPatch,
  ): Record<string, unknown> => {
    let nextMetadata = metadata;
    if (hasPatchField(patch, "sessionType")) {
      nextMetadata = setOptionalMetadataValue(nextMetadata, "session_type", patch.sessionType);
      nextMetadata = setOptionalMetadataValue(nextMetadata, "runtime", patch.sessionType);
    }
    if (hasPatchField(patch, "uiReadAt")) {
      nextMetadata = setOptionalMetadataValue(nextMetadata, "ui_last_read_at", patch.uiReadAt);
    }
    return nextMetadata;
  };

  private applyProjectPatch = (
    metadata: Record<string, unknown>,
    patch: SessionSettingsPatch,
  ): void => {
    if (!hasPatchField(patch, "projectRoot")) {
      return;
    }
    delete metadata.projectRoot;
    if (!patch.projectRoot) {
      delete metadata.project_root;
      return;
    }
    try {
      metadata.project_root = realpathSync(patch.projectRoot);
    } catch {
      throw new ProjectError("PROJECT_PATH_NOT_FOUND", "project directory does not exist");
    }
  };
}

export function createRouterNcpProjectManager(storeDirectory: string): ProjectManager {
  return new ProjectManager({
    storePath: join(storeDirectory, "projects.json"),
    getDefaultWorkspacePath: () => join(tmpdir(), "nextclaw-default-workspace"),
  });
}

export function writeRouterNcpSkill(skillDir: string, description: string): void {
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), `---\ndescription: ${description}\n---`);
}
