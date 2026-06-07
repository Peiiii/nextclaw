/* global chrome, crypto */

import { collectInteractiveNodes, collectPageSnapshot } from "./page-snapshot.utils.js";
import { assertWebUrl, toBrowserTabInfo, waitForTabReady } from "./browser-tab.utils.js";
import { SUPPORTED_COMMANDS } from "./browser-commands.constants.js";
import { capturePageScreenshot } from "./page-screenshot.utils.js";

const HOST_NAME = "com.nextclaw.browserconnector";
const PROTOCOL_VERSION = 1;
const MAX_TEXT_LENGTH = 12000;
const RECONNECT_DELAY_MS = 2000;
const TAB_READY_TIMEOUT_MS = 10000;
const PAGE_ACTION_SCRIPT_FILES = ["page-action-dom.utils.js", "page-action-runner.utils.js"];
const PAGE_ACTION_RUNNER_NAME = "__nextclawBrowserConnectorRunPageAction";
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
    case "extension.reload":
      return reloadExtension();
    case "tabs.get":
      return getTabByRef(payload.tabRef).then(toBrowserTabInfo);
    case "tabs.selected":
      return selectedTab();
    case "tabs.open":
      return openTab(payload.url, payload.active !== false);
    case "tabs.claim":
      return claimTab(payload.tabRef);
    case "tabs.close":
      return closeTab(payload.tabRef);
    case "page.snapshot":
      return snapshotPage(payload.tabRef, payload.interactive === true);
    case "page.screenshot":
      return screenshotPage(payload.tabRef, {
        includeDataUrl: payload.includeDataUrl !== false,
        fullPage: payload.fullPage === true,
        clip: payload.clip,
      });
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
    case "page.inspect":
      return inspectPage(payload.tabRef, payload);
    case "page.click":
      return clickPage(payload.tabRef, payload.selector, payload.ref, payload.frameSelector);
    case "page.fill":
      return fillPage(payload.tabRef, payload.selector, payload.ref, payload.text, payload.frameSelector, payload.mode);
    case "page.type":
      return fillPage(payload.tabRef, payload.selector, payload.ref, payload.text, payload.frameSelector, payload.mode, "page.type");
    case "page.check":
      return checkPage(payload.tabRef, payload.selector, payload.ref, payload.frameSelector);
    case "page.uncheck":
      return uncheckPage(payload.tabRef, payload.selector, payload.ref, payload.frameSelector);
    case "page.select":
      return selectPage(payload.tabRef, payload);
    case "page.press":
      return runPageActionScript(payload.tabRef, "press", { keys: payload.keys });
    case "page.scroll":
      return runPageActionScript(payload.tabRef, "scroll", { x: payload.x ?? 0, y: payload.y ?? 0 });
    case "page.wait":
      return waitForText(payload.tabRef, payload.text, payload.timeoutMs ?? 5000);
    case "page.wait-url":
      return runPageActionScript(payload.tabRef, "wait-url", { url: payload.url, timeoutMs: payload.timeoutMs ?? 5000 });
    case "page.wait-load":
      return runPageActionScript(payload.tabRef, "wait-load", { state: payload.state, timeoutMs: payload.timeoutMs ?? 5000 });
    case "page.wait-element":
      return waitForPageElement(payload.tabRef, payload);
    case "page.logs":
      return logsPage(payload.tabRef, payload);
    default:
      throw new BrowserConnectorExtensionError(
        "UNSUPPORTED_COMMAND",
        `Unsupported browser connector command: ${command}. Reload the Browser Connector extension if the CLI was just updated.`,
      );
  }
}

function reloadExtension() {
  const requestedAt = new Date().toISOString();
  setTimeout(() => {
    chrome.runtime.reload();
  }, 250);

  return {
    action: "extension.reload",
    reloading: true,
    requestedAt,
    extensionVersion: chrome.runtime.getManifest().version,
  };
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
    url: assertWebUrl(url, "tabs.open", createExtensionError),
    active,
  });
  return toBrowserTabInfo(await waitForTabReady(tab.id, TAB_READY_TIMEOUT_MS, createExtensionError));
}

async function closeTab(tabRef) {
  const tab = await getTabByRef(tabRef);
  await chrome.tabs.remove(tab.id);
  return {
    closed: true,
    tabRef,
  };
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

async function inspectPage(tabRef, payload) {
  const targetSelector = await resolveActionSelector(tabRef, payload.selector, payload.ref, "page.inspect");
  return runPageActionScript(tabRef, "inspect", {
    selector: targetSelector,
    ref: payload.ref,
    frameSelector: payload.frameSelector,
  }).then((element) => ({
    tab: element.tab,
    target: {
      selector: targetSelector,
      ref: payload.ref,
      frameSelector: payload.frameSelector,
    },
    element: stripActionTab(element),
    warning: "untrusted-browser-page-content",
  }));
}

async function clickPage(tabRef, selector, ref, frameSelector) {
  const targetSelector = await resolveActionSelector(tabRef, selector, ref, "page.click");
  return runPageActionScript(tabRef, "click", { selector: targetSelector, ref, frameSelector });
}

async function fillPage(tabRef, selector, ref, text, frameSelector, mode = "direct", actionName = "page.fill") {
  const targetSelector = await resolveActionSelector(tabRef, selector, ref, actionName);
  const result = await runPageActionScript(tabRef, "fill", {
    selector: targetSelector,
    ref,
    text,
    frameSelector,
    mode,
  });
  return { ...result, action: actionName };
}

async function checkPage(tabRef, selector, ref, frameSelector) {
  const targetSelector = await resolveActionSelector(tabRef, selector, ref, "page.check");
  return runPageActionScript(tabRef, "check", { selector: targetSelector, ref, frameSelector });
}

async function uncheckPage(tabRef, selector, ref, frameSelector) {
  const targetSelector = await resolveActionSelector(tabRef, selector, ref, "page.uncheck");
  return runPageActionScript(tabRef, "uncheck", { selector: targetSelector, ref, frameSelector });
}

async function selectPage(tabRef, payload) {
  const targetSelector = await resolveActionSelector(tabRef, payload.selector, payload.ref, "page.select");
  return runPageActionScript(tabRef, "select", {
    selector: targetSelector,
    ref: payload.ref,
    frameSelector: payload.frameSelector,
    value: payload.value,
    label: payload.label,
    index: payload.index,
  });
}

async function waitForPageElement(tabRef, payload) {
  const targetSelector = payload.selector || (payload.ref
    ? await resolveActionSelector(tabRef, payload.selector, payload.ref, "page.wait-element")
    : undefined);
  return runPageActionScript(tabRef, "wait-element", {
    selector: targetSelector ?? "body",
    ref: payload.ref,
    frameSelector: payload.frameSelector,
    text: payload.text,
    timeoutMs: payload.timeoutMs ?? 5000,
  });
}

async function logsPage(tabRef, payload) {
  const tab = await getTabByRef(tabRef);
  await executePageAction(tab.id, "logs-install", {}, "page.logs install", "MAIN");
  const [result] = await executePageAction(tab.id, "logs-read", {
    level: payload.level,
    limit: payload.limit,
  }, "page.logs", "MAIN");
  const logs = requiredInjectionResult(result, "page.logs");
  return {
    tab: toBrowserTabInfo(await chrome.tabs.get(tab.id)),
    ...logs,
  };
}

async function runPageActionScript(tabRef, action, payload) {
  return executePageScript(tabRef, action, payload);
}

async function resolveActionSelector(tabRef, selector, ref, command) {
  const targetSelector = typeof selector === "string" && selector.length > 0
    ? selector
    : await resolveSelectorByRef(tabRef, ref, command);
  return targetSelector;
}

async function resolveSelectorByRef(tabRef, ref, command = "page action") {
  if (typeof ref !== "string" || ref.length === 0) {
    throw new BrowserConnectorExtensionError("INVALID_ARGUMENT", `${command} requires selector or ref.`, false);
  }

  const snapshot = await snapshotPage(tabRef, true);
  const candidate = snapshot.interactive.find((item) => item.ref === ref);
  if (!candidate?.selector) {
    throw new BrowserConnectorExtensionError("INVALID_ARGUMENT", `Interactive ref not found: ${ref}. Run page locate or page snapshot --interactive again.`, true);
  }
  return candidate.selector;
}

function stripActionTab(result) {
  const rest = { ...result };
  delete rest.tab;
  return rest;
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

async function screenshotPage(tabRef, options) {
  const tab = await getTabByRef(tabRef);
  return {
    tab: toBrowserTabInfo(tab),
    ...await capturePageScreenshot(tab, options, async (action, payload, label) => {
      const [result] = await executePageAction(tab.id, action, payload, label);
      return requiredInjectionResult(result, label);
    }),
  };
}

async function navigateToUrl(tabRef, url) {
  const tab = await getTabByRef(tabRef);
  await chrome.tabs.update(tab.id, {
    url: assertWebUrl(url, "page.goto", createExtensionError),
    active: true,
  });
  return {
    tab: toBrowserTabInfo(await waitForTabReady(tab.id, TAB_READY_TIMEOUT_MS, createExtensionError)),
    action: "page.goto",
  };
}

async function reloadTab(tabRef) {
  const tab = await getTabByRef(tabRef);
  await chrome.tabs.reload(tab.id);
  return {
    tab: toBrowserTabInfo(await waitForTabReady(tab.id, TAB_READY_TIMEOUT_MS, createExtensionError)),
    action: "page.reload",
  };
}

async function goBack(tabRef) {
  const tab = await getTabByRef(tabRef);
  await chrome.tabs.goBack(tab.id);
  return {
    tab: toBrowserTabInfo(await waitForTabReady(tab.id, TAB_READY_TIMEOUT_MS, createExtensionError)),
    action: "page.back",
  };
}

async function goForward(tabRef) {
  const tab = await getTabByRef(tabRef);
  await chrome.tabs.goForward(tab.id);
  return {
    tab: toBrowserTabInfo(await waitForTabReady(tab.id, TAB_READY_TIMEOUT_MS, createExtensionError)),
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

async function executePageScript(tabRef, actionName, payload) {
  const tab = await getTabByRef(tabRef);
  const [result] = await executePageAction(tab.id, actionName, payload, "page action");
  const action = requiredInjectionResult(result, "page action");
  return {
    tab: toBrowserTabInfo(await chrome.tabs.get(tab.id)),
    ...action,
  };
}

async function executePageAction(tabId, actionName, payload, action, world) {
  await executeScriptFiles(tabId, PAGE_ACTION_SCRIPT_FILES, action, world);
  return executeScript(tabId, invokeInjectedPageAction, [PAGE_ACTION_RUNNER_NAME, actionName, payload], action, world);
}

function invokeInjectedPageAction(runnerName, actionName, payload) {
  const runner = globalThis[runnerName];
  if (typeof runner !== "function") {
    throw new Error(`Browser Connector page action runner is not installed: ${runnerName}`);
  }
  return runner(actionName, payload);
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

async function executeScript(tabId, func, args, action, world) {
  try {
    const options = {
      target: { tabId },
      func,
      args,
    };
    if (world) {
      options.world = world;
    }
    return await chrome.scripting.executeScript({
      ...options,
    });
  } catch (error) {
    throw new BrowserConnectorExtensionError(
      "PAGE_SCRIPT_FAILED",
      `${action} script injection failed. Reload the page or check whether Chrome allows script injection for this tab. ${error instanceof Error ? error.message : ""}`.trim(),
    );
  }
}

async function executeScriptFiles(tabId, files, action, world) {
  try {
    const options = {
      target: { tabId },
      files,
    };
    if (world) {
      options.world = world;
    }
    return await chrome.scripting.executeScript(options);
  } catch (error) {
    throw new BrowserConnectorExtensionError(
      "PAGE_SCRIPT_FAILED",
      `${action} script injection failed. Reload the page or check whether Chrome allows script injection for this tab. ${error instanceof Error ? error.message : ""}`.trim(),
    );
  }
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

function createExtensionError(code, message, recoverable = true) {
  return new BrowserConnectorExtensionError(code, message, recoverable);
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
