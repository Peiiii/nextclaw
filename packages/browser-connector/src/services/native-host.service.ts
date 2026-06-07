import { randomUUID } from "node:crypto";
import { stdin, stdout } from "node:process";

import { BrowserLeaseManager } from "@/managers/browser-lease.manager.js";
import type { ConfigRepository } from "@/repositories/config.repository.js";
import type {
  BrowserExtensionMessage,
  BrowserIpcCommand,
  BrowserIpcRequest,
  BrowserIpcResponse,
} from "@/types/browser-connector-json.types.js";
import { SUPPORTED_BROWSER_IPC_COMMANDS } from "@/types/browser-connector-json.types.js";
import type {
  BrowserConnectorStatus,
  BrowserTabInfo,
} from "@/types/browser-connector.types.js";
import {
  BrowserConnectorError,
  type BrowserConnectorCommandError,
} from "@/types/cli-output.types.js";
import { toCommandFailure } from "@/utils/error.utils.js";
import { NativeMessagingConnection } from "@/utils/native-messaging-protocol.utils.js";
import { LocalIpcServerService } from "@/services/local-ipc-server.service.js";

type PendingExtensionRequest = {
  resolve: (data: unknown) => void;
  reject: (error: BrowserConnectorError) => void;
};

type ExtensionInfo = {
  browserInstanceId: string;
  extensionVersion: string;
  protocolVersion?: number;
  capabilities?: string[];
};

export class NativeHostService {
  private readonly leaseManager = new BrowserLeaseManager();
  private readonly connectorOpenedTabs = new Set<string>();
  private readonly pendingRequests = new Map<string, PendingExtensionRequest>();
  private ipcServer?: LocalIpcServerService;
  private extensionInfo?: ExtensionInfo;

  constructor(
    private readonly configRepository: ConfigRepository,
    private readonly connection = new NativeMessagingConnection(stdin, stdout),
  ) {}

  run = async (): Promise<void> => {
    const config = await this.configRepository.readConfig();
    this.ipcServer = new LocalIpcServerService(config.ipcPath, this.handleIpcRequest);
    await this.ipcServer.start();
    this.connection.on("message", this.handleExtensionMessage);
    this.connection.on("close", this.handleExtensionClose);
    this.connection.start();
  };

  stop = async (): Promise<void> => {
    await this.ipcServer?.stop();
    this.ipcServer = undefined;
  };

  private handleIpcRequest = async (
    request: BrowserIpcRequest,
  ): Promise<BrowserIpcResponse> => {
    try {
      const data = await this.dispatchIpcRequest(request);
      return {
        id: request.id,
        ok: true,
        data,
      };
    } catch (error) {
      return {
        id: request.id,
        ...toCommandFailure(error),
      };
    }
  };

  private dispatchIpcRequest = async (
    request: BrowserIpcRequest,
  ): Promise<unknown> => {
    const config = await this.configRepository.readConfig();

    if (request.command === "browser.status") {
      const extensionCapabilities = this.extensionInfo?.capabilities;
      return {
        connected: this.extensionInfo !== undefined,
        browserInstanceId: this.extensionInfo?.browserInstanceId,
        extensionVersion: this.extensionInfo?.extensionVersion,
        protocolVersion: this.extensionInfo?.protocolVersion,
        extensionCapabilities,
        missingExtensionCapabilities: this.extensionInfo
          ? missingCapabilities(extensionCapabilities)
          : undefined,
        activeLeaseCount: this.leaseManager.countActiveLeases(),
        nativeHostName: config.nativeHostName,
      } satisfies BrowserConnectorStatus;
    }

    if (request.command === "tabs.claim") {
      const tab = await this.forwardToExtension<BrowserTabInfo>(
        request.command,
        request.payload,
      );
      return this.leaseManager.createLease(tab);
    }

    if (request.command === "tabs.open") {
      const tab = await this.forwardToExtension<BrowserTabInfo>(
        request.command,
        request.payload,
      );
      this.connectorOpenedTabs.add(tab.tabRef);
      return tab;
    }

    if (request.command === "tabs.close") {
      const tabRef = assertPayloadString(request.payload, "tabRef");
      const ownedByConnector = this.connectorOpenedTabs.has(tabRef);
      if (!ownedByConnector && request.payload?.confirmed !== true) {
        throw new BrowserConnectorError(
          "ACTION_REQUIRES_CONFIRMATION",
          "tabs.close requires confirmed user approval for tabs not opened by Browser Connector.",
          { recoverable: true },
        );
      }
      await this.forwardToExtension(request.command, request.payload);
      this.connectorOpenedTabs.delete(tabRef);
      return { closed: true, tabRef, ownedByConnector };
    }

    if (request.command === "tabs.get" || request.command === "tabs.selected") {
      return this.forwardToExtension(request.command, request.payload);
    }

    if (request.command === "tabs.finalize") {
      const leaseId = assertPayloadString(request.payload, "leaseId");
      this.leaseManager.finalizeLease(leaseId);
      return { finalized: true, leaseId };
    }

    if (isPageCommand(request.command)) {
      const leaseId = assertPayloadString(request.payload, "leaseId");
      const lease = this.leaseManager.resolveLease(leaseId);
      return this.forwardToExtension(request.command, {
        ...request.payload,
        tabRef: lease.tab.tabRef,
      });
    }

    return this.forwardToExtension(request.command, request.payload);
  };

  private forwardToExtension = async <TData>(
    command: BrowserIpcCommand,
    payload?: Record<string, unknown>,
  ): Promise<TData> => {
    if (!this.extensionInfo) {
      throw new BrowserConnectorError(
        "EXTENSION_DISCONNECTED",
        "Browser Connector Chrome extension is not connected. Enable the extension in Chrome and rerun doctor.",
        { recoverable: true },
      );
    }

    const requestId = randomUUID();
    const data = await new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(
          new BrowserConnectorError(
            "IPC_REQUEST_FAILED",
            `Timed out waiting for extension response to ${command}.`,
            { recoverable: true },
          ),
        );
      }, 10_000);

      this.pendingRequests.set(requestId, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.connection.send({
        kind: "request",
        requestId,
        command,
        payload,
      });
    });

    return data as TData;
  };

  private handleExtensionMessage = (message: BrowserExtensionMessage): void => {
    if (message.kind === "extension.ready") {
      this.extensionInfo = {
        browserInstanceId: message.browserInstanceId,
        extensionVersion: message.extensionVersion,
        protocolVersion: message.protocolVersion,
        capabilities: message.capabilities,
      };
      return;
    }

    const pending = this.pendingRequests.get(message.requestId);

    if (!pending) {
      return;
    }

    this.pendingRequests.delete(message.requestId);

    if (message.ok) {
      pending.resolve(message.data);
      return;
    }

    pending.reject(toBrowserConnectorError(message.error));
  };

  private handleExtensionClose = (): void => {
    this.extensionInfo = undefined;

    for (const [requestId, pending] of this.pendingRequests) {
      this.pendingRequests.delete(requestId);
      pending.reject(
        new BrowserConnectorError(
          "EXTENSION_DISCONNECTED",
          "Browser Connector Chrome extension disconnected.",
          { recoverable: true },
        ),
      );
    }
  };
}

const isPageCommand = (command: BrowserIpcCommand): boolean =>
  command.startsWith("page.");

const missingCapabilities = (
  extensionCapabilities: string[] | undefined,
): string[] =>
  SUPPORTED_BROWSER_IPC_COMMANDS.filter(
    (command) => !extensionCapabilities?.includes(command),
  );

const assertPayloadString = (
  payload: Record<string, unknown> | undefined,
  fieldName: string,
): string => {
  const value = payload?.[fieldName];

  if (typeof value !== "string" || value.length === 0) {
    throw new BrowserConnectorError(
      "INVALID_ARGUMENT",
      `${fieldName} must be a non-empty string.`,
    );
  }

  return value;
};

const toBrowserConnectorError = (
  error: BrowserConnectorCommandError | undefined,
): BrowserConnectorError =>
  new BrowserConnectorError(
    error?.code ?? "UNKNOWN_FAILURE",
    error?.message ?? "Browser extension request failed.",
    { recoverable: error?.recoverable ?? false },
  );
