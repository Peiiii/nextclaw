import type { Chat, ChatTarget } from "@nextclaw/ncp-toolkit";
import type { NcpMessagePart } from "@nextclaw/ncp";
import { loadWeixinAccount, listStoredWeixinAccountIds } from "./weixin-account.store.js";
import { sendWeixinTextMessage } from "./weixin-api.client.js";
import { getWeixinContextToken } from "./weixin-context-token.store.js";
import type { WeixinTypingController } from "./weixin-typing-controller.js";
import {
  DEFAULT_WEIXIN_BASE_URL,
  DEFAULT_WEIXIN_POLL_TIMEOUT_MS,
  resolveConfiguredWeixinAccountIds,
  resolveWeixinAccountSelection,
  type WeixinAccountConfig,
  type WeixinPluginConfig,
} from "./weixin-config.js";

export type ResolvedWeixinAccountRuntime = {
  accountId: string;
  token: string;
  enabled: boolean;
  baseUrl: string;
  pollTimeoutMs: number;
  allowFrom: string[];
};

type WeixinChatDeps = {
  pluginConfig: WeixinPluginConfig;
  typingController: WeixinTypingController;
};

type SendTextParams = {
  stopTyping: boolean;
};

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function stringifyWeixinPartData(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function renderWeixinPartText(part: NcpMessagePart): string {
  switch (part.type) {
    case "text":
      return part.text;
    case "rich-text":
      return part.text;
    case "file":
      return [
        part.name ? `[文件] ${part.name}` : "[文件]",
        part.url ?? part.assetUri ?? "",
      ]
        .filter(Boolean)
        .join("\n");
    case "source":
      return [part.title ?? "", part.url ?? "", part.snippet ?? ""]
        .filter(Boolean)
        .join("\n");
    case "card": {
      const title =
        typeof part.payload.title === "string" ? part.payload.title.trim() : "";
      const summary = title || stringifyWeixinPartData(part.payload);
      return summary ? `[卡片] ${summary}` : "[卡片]";
    }
    case "action":
      return part.label.trim();
    case "step-start":
      return part.title?.trim() ?? "";
    case "reasoning":
      return "";
    case "tool-invocation":
      return "";
    case "extension": {
      const data = stringifyWeixinPartData(part.data).trim();
      return data ? `[扩展内容] ${data}` : "[扩展内容]";
    }
    default:
      return "";
  }
}

export class WeixinChat implements Chat {
  constructor(private readonly deps: WeixinChatDeps) {}

  resolveAccountRuntime = (
    accountId: string,
  ): ResolvedWeixinAccountRuntime | null => {
    const stored = loadWeixinAccount(accountId);
    if (!stored?.token) {
      return null;
    }

    const accountConfig: WeixinAccountConfig =
      this.deps.pluginConfig.accounts?.[accountId] ?? {};

    return {
      accountId,
      token: stored.token,
      enabled:
        accountConfig.enabled !== false &&
        this.deps.pluginConfig.enabled !== false,
      baseUrl:
        accountConfig.baseUrl ||
        stored.baseUrl ||
        this.deps.pluginConfig.baseUrl ||
        DEFAULT_WEIXIN_BASE_URL,
      pollTimeoutMs:
        this.deps.pluginConfig.pollTimeoutMs ??
        DEFAULT_WEIXIN_POLL_TIMEOUT_MS,
      allowFrom: Array.from(
        new Set([
          ...readStringArray(this.deps.pluginConfig.allowFrom),
          ...readStringArray(accountConfig.allowFrom),
        ]),
      ),
    };
  };

  startTyping = async (target: ChatTarget): Promise<void> => {
    const accountId = this.resolveAccountId(target);
    if (!accountId) {
      return;
    }

    const account = this.resolveAccountRuntime(accountId);
    const contextToken = this.resolveContextToken(target, accountId);
    if (!account?.enabled || !account.token || !contextToken) {
      return;
    }

    await this.deps.typingController.start({
      accountId: account.accountId,
      userId: target.conversationId,
      contextToken,
      baseUrl: account.baseUrl,
      token: account.token,
    });
  };

  sendPart = async (target: ChatTarget, part: NcpMessagePart): Promise<void> => {
    const text = renderWeixinPartText(part);
    if (!text.trim()) {
      return;
    }
    await this.sendText(target, text, {
      stopTyping: false,
    });
  };

  sendError = async (
    target: ChatTarget,
    message: string,
  ): Promise<void> => {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) {
      return;
    }
    await this.sendText(target, normalizedMessage, {
      stopTyping: true,
    });
  };

  stopTyping = async (target: ChatTarget): Promise<void> => {
    const accountId = this.resolveAccountId(target);
    if (!accountId) {
      return;
    }
    await this.deps.typingController.stop({
      accountId,
      userId: target.conversationId,
    });
  };

  private resolveAccountId = (target: ChatTarget): string | undefined => {
    const requestedAccountId =
      readString(target.accountId) ??
      readString(target.metadata?.accountId) ??
      readString(target.metadata?.account_id) ??
      null;

    return resolveWeixinAccountSelection(
      this.deps.pluginConfig,
      Array.from(
        new Set([
          ...resolveConfiguredWeixinAccountIds(this.deps.pluginConfig),
          ...listStoredWeixinAccountIds(),
        ]),
      ),
      requestedAccountId,
    );
  };

  private resolveContextToken = (
    target: ChatTarget,
    accountId: string,
  ): string | undefined => {
    return (
      readString(target.metadata?.context_token) ??
      getWeixinContextToken(accountId, target.conversationId)
    );
  };

  private sendText = async (
    target: ChatTarget,
    text: string,
    params: SendTextParams,
  ): Promise<void> => {
    const accountId = this.resolveAccountId(target);
    if (!accountId) {
      throw new Error(
        "weixin send failed: accountId is required when multiple accounts are configured",
      );
    }

    const account = this.resolveAccountRuntime(accountId);
    if (!account?.enabled || !account.token) {
      throw new Error(
        `weixin send failed: account "${accountId}" is not logged in`,
      );
    }

    const contextToken = this.resolveContextToken(target, accountId);

    try {
      await sendWeixinTextMessage({
        baseUrl: account.baseUrl,
        token: account.token,
        toUserId: target.conversationId,
        text,
        contextToken,
      });
    } finally {
      if (!params.stopTyping) {
        return;
      }
      await this.deps.typingController.stop({
        accountId: account.accountId,
        userId: target.conversationId,
      });
    }
  };
}
