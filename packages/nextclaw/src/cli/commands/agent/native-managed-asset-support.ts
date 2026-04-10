import { basename, join } from "node:path";
import {
  getDataDir,
  Tool,
  type ContextUserContentBuilder,
  type InboundAttachment,
} from "@nextclaw/core";
import {
  LocalAssetStore,
  type StoredAssetRecord,
} from "@nextclaw/ncp-agent-runtime";
import type { NcpMessagePart, NcpTool } from "@nextclaw/ncp";
import { buildLegacyUserContent } from "../ncp/nextclaw-ncp-message-bridge.js";
import { createAssetTools } from "../ncp/runtime/ncp-asset-tools.js";

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

class NcpToolAdapter extends Tool {
  constructor(private readonly tool: NcpTool) {
    super();
  }

  get name(): string {
    return this.tool.name;
  }

  get description(): string {
    return this.tool.description ?? this.tool.name;
  }

  get parameters(): Record<string, unknown> {
    return this.tool.parameters ?? {
      type: "object",
      properties: {},
    };
  }

  validateArgs = (params: Record<string, unknown>): string[] =>
    this.tool.validateArgs?.(params) ?? [];

  execute = async (params: Record<string, unknown>): Promise<unknown> => this.tool.execute(params);
}

export class NativeManagedAssetSupport {
  readonly buildUserContent: ContextUserContentBuilder;
  readonly prepareInboundAttachments: (attachments: InboundAttachment[]) => Promise<InboundAttachment[]>;
  readonly additionalTools: Tool[];

  constructor(private readonly assetStore: LocalAssetStore) {
    this.additionalTools = createAssetTools({ assetStore }).map((tool) => new NcpToolAdapter(tool));
    this.prepareInboundAttachments = async (attachments) => await this.prepareAttachments(attachments);
    this.buildUserContent = ({ text, attachments }) => this.buildContent({ text, attachments });
  }

  static createDefault(): NativeManagedAssetSupport {
    return new NativeManagedAssetSupport(
      new LocalAssetStore({
        rootDir: join(getDataDir(), "assets"),
      }),
    );
  }

  toRuntimeSupport() {
    return {
      prepareInboundAttachments: this.prepareInboundAttachments,
      buildUserContent: this.buildUserContent,
      additionalTools: this.additionalTools,
    };
  }

  prepareAttachments = async (attachments: InboundAttachment[]): Promise<InboundAttachment[]> => {
    const nextAttachments: InboundAttachment[] = [];

    for (const attachment of attachments) {
      nextAttachments.push(await this.prepareSingleAttachment(attachment));
    }

    return nextAttachments;
  };

  buildContent = (params: {
    text: string;
    attachments: InboundAttachment[];
  }): ReturnType<ContextUserContentBuilder> =>
    buildLegacyUserContent(this.toNcpParts(params.text, params.attachments), {
      assetStore: this.assetStore,
    }) as ReturnType<ContextUserContentBuilder>;

  private prepareSingleAttachment = async (attachment: InboundAttachment): Promise<InboundAttachment> => {
    const nextAttachment = { ...attachment };
    const path = readOptionalString(nextAttachment.path);
    if (!path || nextAttachment.assetUri) {
      return nextAttachment;
    }

    try {
      const record = await this.assetStore.putPath({
        path,
        fileName: this.resolveAttachmentName(nextAttachment),
        mimeType: nextAttachment.mimeType ?? undefined,
      });
      return {
        ...nextAttachment,
        ...this.toStoredAssetPayload(record),
        name: nextAttachment.name ?? record.fileName,
        mimeType: nextAttachment.mimeType ?? record.mimeType,
        size: nextAttachment.size ?? record.sizeBytes,
      };
    } catch {
      return nextAttachment;
    }
  };

  private resolveAttachmentName = (attachment: InboundAttachment): string => {
    const named = readOptionalString(attachment.name);
    if (named) {
      return named;
    }

    const path = readOptionalString(attachment.path);
    if (path) {
      return basename(path);
    }

    const rawUrl = readOptionalString(attachment.url);
    if (!rawUrl) {
      return "asset.bin";
    }

    try {
      const url = new URL(rawUrl);
      const fileName = basename(url.pathname);
      return fileName || "asset.bin";
    } catch {
      return basename(rawUrl) || "asset.bin";
    }
  };

  private toStoredAssetPayload = (record: StoredAssetRecord): InboundAttachment => ({
    assetUri: record.uri,
    name: record.fileName,
    mimeType: record.mimeType,
    size: record.sizeBytes,
    status: "ready",
  });

  private toNcpParts = (text: string, attachments: InboundAttachment[]): NcpMessagePart[] => {
    const parts: NcpMessagePart[] = [];
    if (text.length > 0) {
      parts.push({
        type: "text",
        text,
      });
    }

    for (const attachment of attachments) {
      parts.push({
        type: "file",
        ...(attachment.name ? { name: attachment.name } : {}),
        ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
        ...(attachment.assetUri ? { assetUri: attachment.assetUri } : {}),
        ...(attachment.url ? { url: attachment.url } : {}),
        ...(typeof attachment.size === "number" ? { sizeBytes: attachment.size } : {}),
      });
    }

    return parts;
  };
}

export async function prepareInboundAttachmentsWithManagedAssets(params: {
  attachments: InboundAttachment[];
  assetStore: LocalAssetStore;
}): Promise<InboundAttachment[]> {
  return await new NativeManagedAssetSupport(params.assetStore).prepareAttachments(params.attachments);
}

export function buildManagedAssetUserContent(params: {
  text: string;
  attachments: InboundAttachment[];
  assetStore: LocalAssetStore;
}): ReturnType<ContextUserContentBuilder> {
  return new NativeManagedAssetSupport(params.assetStore).buildContent({
    text: params.text,
    attachments: params.attachments,
  });
}

export function createNativeManagedAssetSupport(params: { assetStore: LocalAssetStore }) {
  return new NativeManagedAssetSupport(params.assetStore).toRuntimeSupport();
}

export function createDefaultNativeManagedAssetSupport() {
  return NativeManagedAssetSupport.createDefault().toRuntimeSupport();
}
