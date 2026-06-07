/* global chrome, crypto, document, MouseEvent, InputEvent, Event, KeyboardEvent, window */

import { collectInteractiveNodes, collectPageSnapshot } from "./page-snapshot.utils.js";

const HOST_NAME = "com.nextclaw.browserconnector";
const PROTOCOL_VERSION = 1;
const MAX_TEXT_LENGTH = 12000;
const RECONNECT_DELAY_MS = 2000;
const TAB_READY_TIMEOUT_MS = 10000;
const SUPPORTED_COMMANDS = [
  "browser.status",
  "tabs.list",
  "tabs.get",
  "tabs.selected",
  "tabs.open",
  "tabs.claim",
  "tabs.finalize",
  "page.snapshot",
  "page.screenshot",
  "page.goto",
  "page.reload",
  "page.back",
  "page.forward",
  "page.locate",
  "page.click",
  "page.type",
  "page.press",
  "page.scroll",
  "page.wait",
];

class BrowserConnectorExtensionError extends Error {
  constructor(code, message, recoverable = true) {
    super(message);
    this.name = "BrowserConnectorExtensionError";
    this.code = code;
    this.recoverable = recoverable;
  }
}

class BrowserConnectorBackgroundController {
  port;
  reconnectTimer;
  browserInstanceId = crypto.randomUUID();

  start = () => {
    chrome.runtime.onMessage.addListener(this.handleRuntimeMessage);
    this.connectNativeHost();
  };

  handleRuntimeMessage = (message, _sender, sendResponse) => {
    if (message?.kind === "status") {
      sendResponse({
        connected: Boolean(this.port),
        browserInstanceId: this.browserInstanceId,
        hostName: HOST_NAME,
        protocolVersion: PROTOCOL_VERSION,
        capabilities: SUPPORTED_COMMANDS,
      });
    }
    return true;
  };

  connectNativeHost = () => {
    this.clearReconnect();
    try {
      this.port = chrome.runtime.connectNative(HOST_NAME);
      this.port.onMessage.addListener((message) => {
        void this.handleHostMessage(message);
      });
      this.port.onDisconnect.addListener(() => {
        this.port = undefined;
        this.scheduleReconnect();
      });
      this.postReady();
    } catch {
      this.port = undefined;
      this.scheduleReconnect();
    }
  };

  scheduleReconnect = () => {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (!this.port) {
        this.connectNativeHost();
      }
    }, RECONNECT_DELAY_MS);
  };

  clearReconnect = () => {
    if (!this.reconnectTimer) {
      return;
    }

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
  };

  postReady = () => {
    this.port?.postMessage({
      kind: "extension.ready",
      browserInstanceId: this.browserInstanceId,
      extensionVersion: chrome.runtime.getManifest().version,
      protocolVersion: PROTOCOL_VERSION,
      capabilities: SUPPORTED_COMMANDS,
    });
  };

  handleHostMessage = async (message) => {
    if (message?.kind !== "request") {
      return;
    }

    try {
      const data = await dispatchRequest(message.command, message.payload ?? {});
      this.port?.postMessage({
        kind: "response",
        requestId: message.requestId,
        ok: true,
        data,
      });
    } catch (error) {
      this.port?.postMessage({
        kind: "response",
        requestId: message.requestId,
        ok: false,
        error: {
          code: errorCode(error),
          message: error instanceof Error ? error.message : "Extension request failed.",
          recoverable: errorRecoverable(error),
        },
      });
    }
  };
}

new BrowserConnectorBackgroundController().start();

async function dispatchRequest(command, payload) {
  switch (command) {
    case "tabs.list":
      return { tabs: await listTabs() };
    case "tabs.get":
      return getTabByRef(payload.tabRef).then(toBrowserTabInfo);
    case "tabs.selected":
      return selectedTab();
    case "tabs.open":
      return openTab(payload.url, payload.active !== false);
    case "tabs.claim":
      return claimTab(payload.tabRef);
    case "page.snapshot":
      return snapshotPage(payload.tabRef, payload.interactive === true);
    case "page.screenshot":
      return screenshotPage(payload.tabRef, payload.includeDataUrl !== false);
    case "page.goto":
      return navigateToUrl(payload.tabRef, payload.url);
    case "page.reload":
      return reloadTab(payload.tabRef);
    case "page.back":
      return goBack(payload.tabRef);
    case "page.forward":
      return goForward(payload.tabRef);
    case "page.locate":
      return locatePage(payload.tabRef, payload.text);
    case "page.click":
      return clickPage(payload.tabRef, payload.selector, payload.ref);
    case "page.type":
      return executePageScript(payload.tabRef, typeIntoElement, [
        payload.selector,
        payload.text,
      ]);
    case "page.press":
      return executePageScript(payload.tabRef, pressKeys, [payload.keys]);
    case "page.scroll":
      return executePageScript(payload.tabRef, scrollPage, [payload.x ?? 0, payload.y ?? 0]);
    case "page.wait":
      return waitForText(payload.tabRef, payload.text, payload.timeoutMs ?? 5000);
    default:
      throw new BrowserConnectorExtensionError(
        "UNSUPPORTED_COMMAND",
        `Unsupported browser connector command: ${command}. Reload the Browser Connector extension if the CLI was just updated.`,
      );
  }
}

async function listTabs() {
  const tabs = await chrome.tabs.query({});
  return tabs
    .filter((tab) => typeof tab.id === "number")
    .map(toBrowserTabInfo);
}

async function claimTab(tabRef) {
  const tab = await getTabByRef(tabRef);
  return toBrowserTabInfo(tab);
}

async function selectedTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return typeof tab?.id === "number" ? toBrowserTabInfo(tab) : undefined;
}

async function openTab(url, active) {
  const tab = await chrome.tabs.create({
    url: assertWebUrl(url, "tabs.open"),
    active,
  });
  return toBrowserTabInfo(await waitForTabReady(tab.id, TAB_READY_TIMEOUT_MS));
}

async function snapshotPage(tabRef, includeInteractive = false) {
  const tab = await getTabByRef(tabRef);
  const [result] = await executeScript(tab.id, collectPageSnapshot, [MAX_TEXT_LENGTH], "page.snapshot");
  const snapshot = requiredInjectionResult(result, "page.snapshot");
  const interactive = includeInteractive
    ? requiredInjectionResult(
        (await executeScript(tab.id, collectInteractiveNodes, [], "page.snapshot interactive"))[0],
        "page.snapshot interactive",
      )
    : [];
  return {
    tab: toBrowserTabInfo(await chrome.tabs.get(tab.id)),
    ...snapshot,
    interactive,
  };
}

async function locatePage(tabRef, text) {
  const query = String(text ?? "").trim();
  if (!query) {
    throw new BrowserConnectorExtensionError("INVALID_ARGUMENT", "page.locate requires text.", false);
  }

  const snapshot = await snapshotPage(tabRef, true);
  const needle = query.toLowerCase();
  const matches = snapshot.interactive
    .filter((candidate) => candidateMatches(candidate, needle))
    .slice(0, 25);

  return {
    tab: snapshot.tab,
    query,
    matches,
    warning: "untrusted-browser-page-content",
  };
}

async function clickPage(tabRef, selector, ref) {
  const targetSelector = typeof selector === "string" && selector.length > 0
    ? selector
    : await resolveSelectorByRef(tabRef, ref);
  return executePageScript(tabRef, clickElement, [{ selector: targetSelector, ref }]);
}

async function resolveSelectorByRef(tabRef, ref) {
  if (typeof ref !== "string" || ref.length === 0) {
    throw new BrowserConnectorExtensionError("INVALID_ARGUMENT", "page.click requires selector or ref.", false);
  }

  const snapshot = await snapshotPage(tabRef, true);
  const candidate = snapshot.interactive.find((item) => item.ref === ref);
  if (!candidate?.selector) {
    throw new BrowserConnectorExtensionError("INVALID_ARGUMENT", `Interactive ref not found: ${ref}. Run page locate or page snapshot --interactive again.`, true);
  }
  return candidate.selector;
}

function candidateMatches(candidate, needle) {
  return [
    candidate.text,
    candidate.ariaLabel,
    candidate.placeholder,
    candidate.role,
    candidate.kind,
    candidate.tagName,
  ].some((value) => String(value ?? "").toLowerCase().includes(needle));
}

async function screenshotPage(tabRef, includeDataUrl) {
  const tab = await getTabByRef(tabRef);
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png",
  });
  return {
    tab: toBrowserTabInfo(tab),
    dataUrl: includeDataUrl ? dataUrl : undefined,
    mimeType: "image/png",
  };
}

async function navigateToUrl(tabRef, url) {
  const tab = await getTabByRef(tabRef);
  await chrome.tabs.update(tab.id, { url: assertWebUrl(url, "page.goto"), active: true });
  return {
    tab: toBrowserTabInfo(await waitForTabReady(tab.id, TAB_READY_TIMEOUT_MS)),
    action: "page.goto",
  };
}

function assertWebUrl(url, command) {
  if (typeof url !== "string" || url.length === 0) {
    throw new BrowserConnectorExtensionError("INVALID_ARGUMENT", `${command} requires url.`, false);
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Unsupported protocol");
    }
    return parsed.toString();
  } catch {
    throw new BrowserConnectorExtensionError(
      "INVALID_ARGUMENT",
      `${command} requires an http or https URL.`,
      false,
    );
  }
}

async function reloadTab(tabRef) {
  const tab = await getTabByRef(tabRef);
  await chrome.tabs.reload(tab.id);
  return {
    tab: toBrowserTabInfo(await waitForTabReady(tab.id, TAB_READY_TIMEOUT_MS)),
    action: "page.reload",
  };
}

async function goBack(tabRef) {
  const tab = await getTabByRef(tabRef);
  await chrome.tabs.goBack(tab.id);
  return {
    tab: toBrowserTabInfo(await waitForTabReady(tab.id, TAB_READY_TIMEOUT_MS)),
    action: "page.back",
  };
}

async function goForward(tabRef) {
  const tab = await getTabByRef(tabRef);
  await chrome.tabs.goForward(tab.id);
  return {
    tab: toBrowserTabInfo(await waitForTabReady(tab.id, TAB_READY_TIMEOUT_MS)),
    action: "page.forward",
  };
}

async function waitForText(tabRef, text, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await snapshotPage(tabRef);
    if (snapshot.text.includes(text)) {
      return {
        tab: snapshot.tab,
        action: "page.wait",
        textMatched: text,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new BrowserConnectorExtensionError(
    "NAVIGATION_TIMEOUT",
    `Timed out waiting for text: ${text}`,
  );
}

async function executePageScript(tabRef, func, args) {
  const tab = await getTabByRef(tabRef);
  const [result] = await executeScript(tab.id, func, args, "page action");
  const action = requiredInjectionResult(result, "page action");
  return {
    tab: toBrowserTabInfo(await chrome.tabs.get(tab.id)),
    ...action,
  };
}

async function getTabByRef(tabRef) {
  const tabId = Number(String(tabRef).replace("chrome-tab:", ""));
  if (!Number.isInteger(tabId)) {
    throw new BrowserConnectorExtensionError("INVALID_ARGUMENT", `Invalid tabRef: ${tabRef}`, false);
  }

  try {
    return await chrome.tabs.get(tabId);
  } catch {
    throw new BrowserConnectorExtensionError(
      "TAB_NOT_FOUND",
      `Chrome tab not found: ${tabRef}. Run tabs list again and claim a current tab.`,
    );
  }
}

async function waitForTabReady(tabId, timeoutMs) {
  const startedAt = Date.now();
  let latest = await chrome.tabs.get(tabId);

  while (Date.now() - startedAt < timeoutMs) {
    latest = await chrome.tabs.get(tabId);
    if ((latest.url || latest.pendingUrl) && latest.status === "complete") {
      return latest;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  if (latest.url || latest.pendingUrl || latest.title) {
    return latest;
  }

  throw new BrowserConnectorExtensionError(
    "NAVIGATION_TIMEOUT",
    `Timed out waiting for Chrome tab to load: chrome-tab:${tabId}`,
  );
}

async function executeScript(tabId, func, args, action) {
  try {
    return await chrome.scripting.executeScript({
      target: { tabId },
      func,
      args,
    });
  } catch (error) {
    throw new BrowserConnectorExtensionError(
      "PAGE_SCRIPT_FAILED",
      `${action} script injection failed. Reload the page or check whether Chrome allows script injection for this tab. ${error instanceof Error ? error.message : ""}`.trim(),
    );
  }
}

function toBrowserTabInfo(tab) {
  return {
    tabRef: `chrome-tab:${tab.id}`,
    title: tab.title ?? "",
    url: redactUrl(tab.url ?? ""),
    active: Boolean(tab.active),
    windowId: tab.windowId,
    lastAccessed: tab.lastAccessed,
    status: tab.status,
    pendingUrl: tab.pendingUrl ? redactUrl(tab.pendingUrl) : undefined,
  };
}

function redactUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname
      .split("/")
      .map(redactPathSegment)
      .join("/");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function redactPathSegment(segment) {
  if (/^sid_[A-Za-z0-9_-]+$/.test(segment)) {
    return "sid_redacted";
  }

  return segment;
}

function requiredInjectionResult(result, action) {
  if (!result?.result) {
    throw new BrowserConnectorExtensionError(
      "PAGE_SCRIPT_RESULT_MISSING",
      `${action} did not return page data. Reload the page or check whether Chrome allows script injection for this tab.`,
    );
  }

  return result.result;
}

function clickElement(target) {
  const selector = typeof target?.selector === "string" ? target.selector : undefined;
  const ref = typeof target?.ref === "string" ? target.ref : undefined;
  const element = selector ? document.querySelector(selector) : undefined;
  if (!element) {
    throw new Error(`Element not found: ${selector ?? ref}`);
  }
  element.scrollIntoView({ block: "center", inline: "center" });
  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  if (typeof element.click === "function") {
    element.click();
  }
  return { action: "page.click", selector: selector ?? selectorForClickTarget(element), ref };
}

function selectorForClickTarget(element) {
  if (element.id && window.CSS?.escape) {
    return `#${window.CSS.escape(element.id)}`;
  }
  const tagName = element.tagName.toLowerCase();
  const dataTestId = element.getAttribute("data-testid");
  if (dataTestId) {
    return `${tagName}[data-testid="${String(dataTestId).replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"]`;
  }
  return tagName;
}

function typeIntoElement(selector, text) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  element.focus();
  if ("value" in element) {
    element.value = text;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return { action: "page.type", selector };
  }
  element.textContent = text;
  element.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
  return { action: "page.type", selector };
}

function pressKeys(keys) {
  const key = String(keys);
  document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  document.activeElement?.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
  return { action: "page.press" };
}

function scrollPage(x, y) {
  window.scrollBy(Number(x), Number(y));
  return { action: "page.scroll" };
}

function errorCode(error) {
  return error instanceof BrowserConnectorExtensionError
    ? error.code
    : "IPC_REQUEST_FAILED";
}

function errorRecoverable(error) {
  return error instanceof BrowserConnectorExtensionError
    ? error.recoverable
    : true;
}
