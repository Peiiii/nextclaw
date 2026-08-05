import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { InboxDelivery } from "@nextclaw/shared";

const INBOX_DELIVERY_STORE_VERSION = 1;

type InboxDeliveryStoreFile = {
  version: typeof INBOX_DELIVERY_STORE_VERSION;
  deliveries: InboxDelivery[];
};

export class InboxDeliveryStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InboxDeliveryStoreError";
  }
}

export class InboxDeliveryStore {
  constructor(private readonly storePath: string) {}

  list = async (): Promise<InboxDelivery[]> => {
    try {
      return this.parseStoreFile(await readFile(this.storePath, "utf8")).deliveries;
    } catch (error) {
      if (this.isMissingFileError(error)) {
        return [];
      }
      if (error instanceof SyntaxError) {
        throw new InboxDeliveryStoreError("inbox delivery store contains invalid JSON");
      }
      throw error;
    }
  };

  save = async (deliveries: readonly InboxDelivery[]): Promise<void> => {
    const tempPath = `${this.storePath}.${randomUUID()}.tmp`;
    const storeFile: InboxDeliveryStoreFile = {
      version: INBOX_DELIVERY_STORE_VERSION,
      deliveries: deliveries.map((delivery) => structuredClone(delivery)),
    };
    await mkdir(dirname(this.storePath), { recursive: true });
    try {
      await writeFile(tempPath, `${JSON.stringify(storeFile, null, 2)}\n`, "utf8");
      await rename(tempPath, this.storePath);
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  };

  private parseStoreFile = (source: string): InboxDeliveryStoreFile => {
    const value = JSON.parse(source) as unknown;
    if (
      !this.isRecord(value) ||
      value.version !== INBOX_DELIVERY_STORE_VERSION ||
      !Array.isArray(value.deliveries) ||
      !value.deliveries.every(this.isDelivery)
    ) {
      throw new InboxDeliveryStoreError("inbox delivery store has an unsupported structure");
    }
    return {
      version: INBOX_DELIVERY_STORE_VERSION,
      deliveries: value.deliveries.map((delivery) => structuredClone(delivery)),
    };
  };

  private isDelivery = (value: unknown): value is InboxDelivery => {
    if (!this.isRecord(value) || !this.isSource(value.source)) {
      return false;
    }
    return (
      typeof value.id === "string" &&
      typeof value.title === "string" &&
      (value.summary === null || typeof value.summary === "string") &&
      typeof value.content === "string" &&
      value.contentType === "markdown" &&
      typeof value.createdAt === "string" &&
      typeof value.updatedAt === "string" &&
      this.isOptionalTimestamp(value.presentedAt) &&
      this.isOptionalTimestamp(value.readAt) &&
      this.isOptionalTimestamp(value.archivedAt) &&
      (value.conversationSessionId === null || typeof value.conversationSessionId === "string")
    );
  };

  private isSource = (value: unknown): value is InboxDelivery["source"] =>
    this.isRecord(value) &&
    value.kind === "agent" &&
    this.isOptionalString(value.agentId) &&
    this.isOptionalString(value.sessionId) &&
    this.isOptionalString(value.toolCallId) &&
    this.isOptionalString(value.filePath);

  private isOptionalString = (value: unknown): value is string | null =>
    value === null || typeof value === "string";

  private isOptionalTimestamp = (value: unknown): value is string | null =>
    this.isOptionalString(value);

  private isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

  private isMissingFileError = (error: unknown): boolean =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT";
}
