import { createHash } from "node:crypto";
import type { AutomationManager } from "@kernel/managers/automation.manager.js";
import type { InboxDeliveryManager } from "@kernel/managers/inbox-delivery.manager.js";
import {
  createSystemObjectReferenceUri,
  parseSystemObjectReferenceUri,
  SYSTEM_OBJECT_REFERENCE_DEFAULT_LIMIT,
  SYSTEM_OBJECT_REFERENCE_MAX_LIMIT,
  SYSTEM_OBJECT_TYPE_CRON_JOB,
  SYSTEM_OBJECT_TYPE_INBOX_DELIVERY,
  type InboxDelivery,
  type SystemObjectReferenceDisplayText,
  type SystemObjectReferenceGroupDescriptor,
  type SystemObjectReferenceGroupIcon,
  type SystemObjectReferenceItem,
  type SystemObjectReferenceListView,
  type SystemObjectResolvedReference,
} from "@nextclaw/shared";
import {
  isTextLikeAsset,
  type LocalAssetStore,
} from "@nextclaw/ncp-agent-runtime";

const MAX_SYSTEM_OBJECT_SNAPSHOT_BYTES = 1024 * 1024;

export type SystemObjectReferenceSnapshotSource = {
  item: SystemObjectReferenceItem;
  content: string;
  fileName: string;
  mimeType: string;
};

export type SystemObjectReferenceProvider = {
  group: SystemObjectReferenceGroupDescriptor;
  list: () => Promise<readonly SystemObjectReferenceItem[]> | readonly SystemObjectReferenceItem[];
  resolve: (
    objectId: string,
  ) => Promise<SystemObjectReferenceSnapshotSource | null> | SystemObjectReferenceSnapshotSource | null;
};

export type SystemObjectReferenceErrorCode =
  | "SYSTEM_OBJECT_INVALID_REFERENCE"
  | "SYSTEM_OBJECT_NOT_FOUND"
  | "SYSTEM_OBJECT_PROVIDER_CONTRACT";

export class SystemObjectReferenceError extends Error {
  constructor(
    readonly code: SystemObjectReferenceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SystemObjectReferenceError";
  }
}

export function isSystemObjectReferenceError(
  error: unknown,
): error is SystemObjectReferenceError {
  return error instanceof SystemObjectReferenceError;
}

function normalizedSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function scoreSearchItem(item: SystemObjectReferenceItem, query: string): number {
  if (!query) return 1;
  const fields = [item.label, item.objectId, item.description ?? ""]
    .map(normalizedSearchText)
    .filter(Boolean);
  if (fields.some((field) => field === query)) return 400;
  if (fields.some((field) => field.startsWith(query))) return 300;
  if (fields.some((field) => field.split(/\s+/).some((word) => word.startsWith(query)))) return 200;
  return fields.some((field) => field.includes(query)) ? 100 : 0;
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return SYSTEM_OBJECT_REFERENCE_DEFAULT_LIMIT;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > SYSTEM_OBJECT_REFERENCE_MAX_LIMIT) {
    throw new SystemObjectReferenceError(
      "SYSTEM_OBJECT_INVALID_REFERENCE",
      `limit must be an integer between 1 and ${SYSTEM_OBJECT_REFERENCE_MAX_LIMIT}`,
    );
  }
  return limit;
}

const SYSTEM_OBJECT_GROUP_ICONS = new Set<SystemObjectReferenceGroupIcon>([
  "calendar-clock",
  "file",
  "inbox",
]);

function normalizeDisplayText(
  value: SystemObjectReferenceDisplayText,
  field: string,
): SystemObjectReferenceDisplayText {
  const defaultText = value.default.trim();
  if (!defaultText) {
    throw new Error(`System object provider group ${field} must be non-empty.`);
  }
  const translations = Object.fromEntries(
    Object.entries(value.translations ?? {})
      .map(([language, text]) => [language.trim(), text.trim()] as const)
      .filter(([language, text]) => language && text),
  );
  return {
    default: defaultText,
    ...(Object.keys(translations).length > 0 ? { translations } : {}),
  };
}

function normalizeProviderGroup(
  group: SystemObjectReferenceGroupDescriptor,
): SystemObjectReferenceGroupDescriptor {
  const objectType = group.objectType.trim();
  if (
    !objectType ||
    !SYSTEM_OBJECT_GROUP_ICONS.has(group.icon) ||
    !Number.isSafeInteger(group.order)
  ) {
    throw new Error(`System object provider group is invalid: ${objectType}`);
  }
  return {
    objectType,
    label: normalizeDisplayText(group.label, "label"),
    description: normalizeDisplayText(group.description, "description"),
    icon: group.icon,
    order: group.order,
  };
}

function safeSnapshotFileName(label: string, suffix: string): string {
  const stem = label.trim().replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "");
  return `${stem || "system-object"}.${suffix}`;
}

function truncate(value: string | null | undefined, maxLength = 180): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!normalized) return null;
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 1)}…`;
}

function toIsoTime(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export class SystemObjectReferenceManager {
  private readonly providers = new Map<string, SystemObjectReferenceProvider>();
  private readonly resolvedCache = new Map<string, SystemObjectResolvedReference>();

  constructor(
    private readonly assetStore: Pick<LocalAssetStore, "putBytes" | "statRecord">,
    providers: readonly SystemObjectReferenceProvider[] = [],
  ) {
    providers.forEach((provider) => this.registerProvider(provider));
  }

  registerProvider = (provider: SystemObjectReferenceProvider): (() => void) => {
    const group = normalizeProviderGroup(provider.group);
    const objectType = group.objectType;
    if (this.providers.has(objectType)) {
      throw new Error(`System object provider is invalid or already registered: ${objectType}`);
    }
    const registeredProvider = { ...provider, group };
    this.providers.set(objectType, registeredProvider);
    return () => {
      if (this.providers.get(objectType) === registeredProvider) {
        this.providers.delete(objectType);
      }
    };
  };

  listReferences = async (params: {
    query?: string;
    limit?: number;
    objectType?: string;
  } = {}): Promise<SystemObjectReferenceListView> => {
    const query = normalizedSearchText(params.query ?? "");
    const limit = normalizeLimit(params.limit);
    const requestedObjectType = params.objectType?.trim();
    if (params.objectType !== undefined && !requestedObjectType) {
      throw new SystemObjectReferenceError(
        "SYSTEM_OBJECT_INVALID_REFERENCE",
        "objectType must be a non-empty registered system object type",
      );
    }
    const requestedProvider = requestedObjectType
      ? this.providers.get(requestedObjectType)
      : undefined;
    if (requestedObjectType && !requestedProvider) {
      throw new SystemObjectReferenceError(
        "SYSTEM_OBJECT_INVALID_REFERENCE",
        `system object provider is not registered: ${requestedObjectType}`,
      );
    }
    const providers = requestedProvider ? [requestedProvider] : [...this.providers.values()];
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    const shouldIncludeItems = Boolean(requestedObjectType || query);
    const groups = await Promise.all(providers.map(async (provider) => {
      const matches = (await provider.list())
        .map((item) => {
          this.assertListItemContract(item, provider.group.objectType);
          return { item, score: scoreSearchItem(item, query) };
        })
        .filter(({ score }) => score > 0)
        .sort((left, right) =>
          right.score - left.score ||
          right.item.updatedAt.localeCompare(left.item.updatedAt) ||
          collator.compare(left.item.label, right.item.label)
        );
      return {
        ...structuredClone(provider.group),
        items: shouldIncludeItems
          ? matches.slice(0, limit).map(({ item }) => structuredClone(item))
          : [],
        total: matches.length,
      };
    }));
    const visibleGroups = groups
      .filter((group) => !query || group.total > 0)
      .sort((left, right) =>
        left.order - right.order || collator.compare(left.label.default, right.label.default)
      );
    return {
      groups: visibleGroups,
      total: visibleGroups.reduce((total, group) => total + group.total, 0),
    };
  };

  resolveReference = async (uri: string): Promise<SystemObjectResolvedReference> => {
    const parsed = parseSystemObjectReferenceUri(uri);
    if (!parsed) {
      throw new SystemObjectReferenceError(
        "SYSTEM_OBJECT_INVALID_REFERENCE",
        `invalid system object reference: ${uri}`,
      );
    }
    const provider = this.providers.get(parsed.objectType);
    if (!provider) {
      throw new SystemObjectReferenceError(
        "SYSTEM_OBJECT_INVALID_REFERENCE",
        `system object provider is not registered: ${parsed.objectType}`,
      );
    }
    const source = await provider.resolve(parsed.objectId);
    if (!source) {
      throw new SystemObjectReferenceError(
        "SYSTEM_OBJECT_NOT_FOUND",
        `system object not found: ${uri}`,
      );
    }
    this.assertSnapshotContract(source, parsed);
    const bytes = new TextEncoder().encode(source.content);
    if (bytes.byteLength > MAX_SYSTEM_OBJECT_SNAPSHOT_BYTES) {
      throw new SystemObjectReferenceError(
        "SYSTEM_OBJECT_PROVIDER_CONTRACT",
        `system object snapshot exceeds ${MAX_SYSTEM_OBJECT_SNAPSHOT_BYTES} bytes: ${uri}`,
      );
    }
    const version = createHash("sha256").update(bytes).digest("hex");
    const cacheKey = `${uri}@${version}`;
    const cached = this.resolvedCache.get(cacheKey);
    if (cached && await this.assetStore.statRecord(cached.assetUri)) {
      return structuredClone(cached);
    }
    const asset = await this.assetStore.putBytes({
      bytes,
      fileName: source.fileName,
      mimeType: source.mimeType,
    });
    const resolved: SystemObjectResolvedReference = {
      ...structuredClone(source.item),
      version,
      assetUri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
    };
    this.resolvedCache.set(cacheKey, resolved);
    return structuredClone(resolved);
  };

  private assertSnapshotContract = (
    source: SystemObjectReferenceSnapshotSource,
    parsed: { objectType: string; objectId: string },
  ): void => {
    const expectedUri = createSystemObjectReferenceUri(parsed.objectType, parsed.objectId);
    if (
      source.item.uri !== expectedUri ||
      source.item.objectType !== parsed.objectType ||
      source.item.objectId !== parsed.objectId ||
      !source.item.label.trim() ||
      !source.fileName.trim() ||
      !source.content.trim() ||
      !isTextLikeAsset({ mimeType: source.mimeType, fileName: source.fileName })
    ) {
      throw new SystemObjectReferenceError(
        "SYSTEM_OBJECT_PROVIDER_CONTRACT",
        `system object provider returned an invalid snapshot: ${expectedUri}`,
      );
    }
  };

  private assertListItemContract = (
    item: SystemObjectReferenceItem,
    objectType: string,
  ): void => {
    const expectedUri = createSystemObjectReferenceUri(objectType, item.objectId);
    if (
      item.objectType !== objectType ||
      item.uri !== expectedUri ||
      !item.label.trim() ||
      !item.updatedAt.trim()
    ) {
      throw new SystemObjectReferenceError(
        "SYSTEM_OBJECT_PROVIDER_CONTRACT",
        `system object provider returned an invalid list item: ${item.uri}`,
      );
    }
  };
}

export function createInboxDeliverySystemObjectProvider(
  manager: Pick<InboxDeliveryManager, "getDelivery" | "listDeliveries">,
): SystemObjectReferenceProvider {
  const toItem = (delivery: InboxDelivery): SystemObjectReferenceItem => ({
    uri: createSystemObjectReferenceUri(SYSTEM_OBJECT_TYPE_INBOX_DELIVERY, delivery.id),
    objectType: SYSTEM_OBJECT_TYPE_INBOX_DELIVERY,
    objectId: delivery.id,
    label: delivery.title,
    description: truncate(delivery.summary),
    updatedAt: delivery.updatedAt,
  });
  return {
    group: {
      objectType: SYSTEM_OBJECT_TYPE_INBOX_DELIVERY,
      label: {
        default: "Inbox Reports",
        translations: { en: "Inbox Reports", zh: "收件箱报告" },
      },
      description: {
        default: "Reference reports and delivered content saved by NextClaw.",
        translations: {
          en: "Reference reports and delivered content saved by NextClaw.",
          zh: "引用由 NextClaw 保存的报告和送达内容。",
        },
      },
      icon: "inbox",
      order: 100,
    },
    list: async () => (await manager.listDeliveries()).deliveries.map((delivery) => toItem(delivery)),
    resolve: async (objectId) => {
      const delivery = await manager.getDelivery(objectId);
      if (!delivery) return null;
      const sourceLines = [
        `# ${delivery.title}`,
        "",
        `- Object: ${createSystemObjectReferenceUri(SYSTEM_OBJECT_TYPE_INBOX_DELIVERY, delivery.id)}`,
        `- Created: ${delivery.createdAt}`,
        `- Source agent: ${delivery.source.agentId ?? "unknown"}`,
      ];
      if (delivery.summary) sourceLines.push("", "## Summary", "", delivery.summary);
      sourceLines.push("", "## Content", "", delivery.content);
      return {
        item: toItem(delivery),
        content: sourceLines.join("\n"),
        fileName: safeSnapshotFileName(delivery.title, "md"),
        mimeType: "text/markdown",
      };
    },
  };
}

type CronJob = ReturnType<AutomationManager["listJobs"]>[number];

export function createCronJobSystemObjectProvider(
  automation: Pick<AutomationManager, "listJobs">,
): SystemObjectReferenceProvider {
  const toItem = (job: CronJob): SystemObjectReferenceItem => ({
    uri: createSystemObjectReferenceUri(SYSTEM_OBJECT_TYPE_CRON_JOB, job.id),
    objectType: SYSTEM_OBJECT_TYPE_CRON_JOB,
    objectId: job.id,
    label: job.name,
    description: truncate(job.payload.message),
    updatedAt: new Date(job.updatedAtMs).toISOString(),
  });
  return {
    group: {
      objectType: SYSTEM_OBJECT_TYPE_CRON_JOB,
      label: {
        default: "Scheduled Tasks",
        translations: { en: "Scheduled Tasks", zh: "定时任务" },
      },
      description: {
        default: "Reference task schedules, instructions, and recent run state.",
        translations: {
          en: "Reference task schedules, instructions, and recent run state.",
          zh: "引用任务计划、指令和最近运行状态。",
        },
      },
      icon: "calendar-clock",
      order: 200,
    },
    list: () => automation.listJobs(true).map(toItem),
    resolve: (objectId) => {
      const job = automation.listJobs(true).find(({ id }) => id === objectId);
      if (!job) return null;
      const content = [
        `# ${job.name}`,
        "",
        `- Object: ${createSystemObjectReferenceUri(SYSTEM_OBJECT_TYPE_CRON_JOB, job.id)}`,
        `- Enabled: ${job.enabled ? "yes" : "no"}`,
        `- Delete after run: ${job.deleteAfterRun ? "yes" : "no"}`,
        `- Created: ${new Date(job.createdAtMs).toISOString()}`,
        `- Updated: ${new Date(job.updatedAtMs).toISOString()}`,
        `- Next run: ${toIsoTime(job.state.nextRunAtMs) ?? "none"}`,
        `- Last run: ${toIsoTime(job.state.lastRunAtMs) ?? "none"}`,
        `- Last status: ${job.state.lastStatus ?? "none"}`,
        "",
        "## Schedule",
        "",
        "```json",
        JSON.stringify(job.schedule, null, 2),
        "```",
        "",
        "## Payload",
        "",
        job.payload.message,
        "",
        "```json",
        JSON.stringify({
          kind: job.payload.kind ?? "agent_turn",
          agentId: job.payload.agentId ?? null,
          sessionId: job.payload.sessionId ?? null,
        }, null, 2),
        "```",
        ...(job.state.lastError ? ["", "## Last error", "", job.state.lastError] : []),
      ].join("\n");
      return {
        item: toItem(job),
        content,
        fileName: safeSnapshotFileName(job.name, "md"),
        mimeType: "text/markdown",
      };
    },
  };
}
