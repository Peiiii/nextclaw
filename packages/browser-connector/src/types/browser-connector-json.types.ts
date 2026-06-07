import type {
  BrowserActionResult,
  BrowserConnectorStatus,
  BrowserExtensionReloadResult,
  BrowserPageLocateResult,
  BrowserPageInspectResult,
  BrowserPageSnapshot,
  BrowserScreenshot,
  BrowserTabCloseResult,
  BrowserTabInfo,
  BrowserTabLease,
} from "@/types/browser-connector.types.js";
import type { BrowserConnectorCommandError } from "@/types/cli-output.types.js";

export const BROWSER_CONNECTOR_PROTOCOL_VERSION = 1;

export const SUPPORTED_BROWSER_IPC_COMMANDS = [
  "browser.status",
  "extension.reload",
  "tabs.list",
  "tabs.get",
  "tabs.selected",
  "tabs.open",
  "tabs.claim",
  "tabs.close",
  "tabs.finalize",
  "page.snapshot",
  "page.screenshot",
  "page.goto",
  "page.reload",
  "page.back",
  "page.forward",
  "page.locate",
  "page.inspect",
  "page.click",
  "page.fill",
  "page.type",
  "page.check",
  "page.uncheck",
  "page.select",
  "page.press",
  "page.scroll",
  "page.wait",
  "page.wait-url",
  "page.wait-load",
  "page.wait-element",
  "page.logs",
] as const;

export type BrowserIpcCommand = (typeof SUPPORTED_BROWSER_IPC_COMMANDS)[number];

export type BrowserIpcRequest = {
  id: string;
  command: BrowserIpcCommand;
  payload?: Record<string, unknown>;
};

export type BrowserIpcSuccess<TData = unknown> = {
  id: string;
  ok: true;
  data: TData;
};

export type BrowserIpcFailure = {
  id: string;
  ok: false;
  error: BrowserConnectorCommandError;
};

export type BrowserIpcResponse<TData = unknown> =
  | BrowserIpcSuccess<TData>
  | BrowserIpcFailure;

export type BrowserExtensionRequest = {
  kind: "request";
  requestId: string;
  command: BrowserIpcCommand;
  payload?: Record<string, unknown>;
};

export type BrowserExtensionReadyMessage = {
  kind: "extension.ready";
  browserInstanceId: string;
  extensionVersion: string;
  protocolVersion?: number;
  capabilities?: BrowserIpcCommand[];
};

export type BrowserExtensionResponseMessage = {
  kind: "response";
  requestId: string;
  ok: boolean;
  data?: unknown;
  error?: BrowserConnectorCommandError;
};

export type BrowserExtensionMessage =
  | BrowserExtensionReadyMessage
  | BrowserExtensionResponseMessage;

export type BrowserCommandData =
  | BrowserConnectorStatus
  | BrowserExtensionReloadResult
  | { tabs: BrowserTabInfo[] }
  | BrowserTabInfo
  | BrowserTabCloseResult
  | BrowserTabLease
  | BrowserPageSnapshot
  | BrowserPageLocateResult
  | BrowserPageInspectResult
  | BrowserScreenshot
  | BrowserActionResult
  | { finalized: true; leaseId: string };
