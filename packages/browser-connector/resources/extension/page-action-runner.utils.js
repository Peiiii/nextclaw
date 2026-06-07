/* global document, window, location, Event, InputEvent, MouseEvent, KeyboardEvent, ClipboardEvent, DataTransfer */

var NEXTCLAW_PAGE_ACTION_LOG_LIMIT = 200;

async function nextclawRunPageAction(action, payload = {}) {
  const dom = globalThis.__nextclawBrowserConnectorDom;
  switch (action) {
    case "inspect":
      return dom.inspectTarget(payload);
    case "fill":
      return nextclawPageActionFill(payload, dom);
    case "click":
      return nextclawPageActionClick(payload, dom);
    case "check":
      return nextclawPageActionSetChecked(payload, true, "page.check", dom);
    case "uncheck":
      return nextclawPageActionSetChecked(payload, false, "page.uncheck", dom);
    case "select":
      return nextclawPageActionSelect(payload, dom);
    case "press":
      return nextclawPageActionPress(payload.keys, dom);
    case "scroll":
      window.scrollBy(Number(payload.x ?? 0), Number(payload.y ?? 0));
      return { action: "page.scroll", scroll: dom.scrollState() };
    case "wait-url":
      return nextclawPageActionWaitUrl(payload);
    case "wait-load":
      return nextclawPageActionWaitLoad(payload);
    case "wait-element":
      return nextclawPageActionWaitElement(payload, dom);
    case "metrics":
      return { ...dom.scrollState(), devicePixelRatio: window.devicePixelRatio || 1 };
    case "scroll-to":
      window.scrollTo(Number(payload.x ?? 0), Number(payload.y ?? 0));
      return dom.scrollState();
    case "logs-install":
      return nextclawPageActionInstallLogs();
    case "logs-read":
      return nextclawPageActionReadLogs(payload);
    default:
      throw new Error(`Unsupported page action: ${action}`);
  }
}

function nextclawPageActionFill(target, dom) {
  if (target.mode === "paste") {
    return nextclawPageActionPaste(target, dom);
  }

  const { element, before } = dom.singleEditable(target);
  const text = String(target.text ?? "");
  if ("value" in element) {
    dom.setNativeValue(element, text);
  } else {
    element.focus();
    element.textContent = text;
  }
  nextclawPageActionDispatchInputEvents(element, text);
  const after = dom.inspectResolved(element, target);
  const value = dom.valueOf(element);
  return {
    action: "page.fill",
    selector: target.selector,
    ref: target.ref,
    before,
    after,
    element: after,
    changed: before.value !== after.value || before.text !== after.text,
    inputMode: "direct",
    valueLength: value.length,
    preview: value.slice(0, dom.previewLength),
    matchedExpectedText: value === text,
    pageTextMatched: nextclawPageActionPageTextMatched(text),
  };
}

function nextclawPageActionPaste(target, dom) {
  const resolved = dom.singleElement(target);
  if (resolved.inspection.visible === false) throw new Error("Element is not visible.");
  if (resolved.inspection.enabled === false) throw new Error("Element is disabled.");

  const text = String(target.text ?? "");
  const receiver = nextclawPageActionEditableReceiver(resolved.element);
  const before = dom.inspectResolved(resolved.element, target);
  nextclawPageActionFocusForPaste(resolved.element, receiver);
  nextclawPageActionSelectReceiver(resolved.element, receiver);

  const pasteAccepted = nextclawPageActionDispatchPaste(resolved.element, receiver, text, dom);
  if (!nextclawPageActionPasteMatched(receiver, text, dom)) {
    document.execCommand?.("insertText", false, text);
  }

  const after = dom.inspectResolved(resolved.element, target);
  const receiverState = dom.inspectResolved(receiver, {});
  const receiverValue = dom.valueOf(receiver);
  return {
    action: "page.fill",
    selector: target.selector,
    ref: target.ref,
    before,
    after,
    element: after,
    receiver: receiverState,
    changed: before.value !== after.value || before.text !== after.text || receiverValue.length > 0,
    inputMode: "paste",
    pasteAccepted,
    valueLength: receiverValue.length,
    preview: receiverValue.slice(0, dom.previewLength),
    matchedExpectedText: nextclawPageActionPasteMatched(receiver, text, dom),
    pageTextMatched: nextclawPageActionPageTextMatched(text),
  };
}

function nextclawPageActionEditableReceiver(element) {
  if (nextclawPageActionCanReceiveText(element)) return element;
  const receiver = element.querySelector("textarea,input:not([type='hidden']),[contenteditable='true']");
  if (receiver && nextclawPageActionCanReceiveText(receiver)) return receiver;
  throw new Error("Element does not contain an editable paste receiver.");
}

function nextclawPageActionCanReceiveText(element) {
  const tagName = element.tagName.toLowerCase();
  const inputType = element.getAttribute("type");
  return element.isContentEditable || tagName === "textarea" || (tagName === "input" && inputType !== "hidden");
}

function nextclawPageActionFocusForPaste(element, receiver) {
  element.scrollIntoView({ block: "center", inline: "center" });
  element.focus?.();
  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  receiver.focus();
}

function nextclawPageActionSelectReceiver(element, receiver) {
  if (typeof receiver.select === "function") {
    receiver.select();
    document.execCommand?.("selectAll", false);
    nextclawPageActionDispatchSelectAllShortcut(element, receiver);
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(receiver);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.execCommand?.("selectAll", false);
  nextclawPageActionDispatchSelectAllShortcut(element, receiver);
}

function nextclawPageActionDispatchSelectAllShortcut(element, receiver) {
  for (const eventTarget of Array.from(new Set([receiver, element]))) {
    for (const modifier of ["metaKey", "ctrlKey"]) {
      eventTarget.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "a",
        code: "KeyA",
        [modifier]: true,
      }));
      eventTarget.dispatchEvent(new KeyboardEvent("keyup", {
        bubbles: true,
        cancelable: true,
        key: "a",
        code: "KeyA",
        [modifier]: true,
      }));
    }
  }
}

function nextclawPageActionDispatchPaste(element, receiver, text, dom) {
  const receiverAccepted = nextclawPageActionDispatchPasteTo(receiver, text);
  if (element === receiver || nextclawPageActionPasteMatched(receiver, text, dom)) {
    return receiverAccepted;
  }
  return nextclawPageActionDispatchPasteTo(element, text) && receiverAccepted;
}

function nextclawPageActionDispatchPasteTo(element, text) {
  const data = new DataTransfer();
  data.setData("text/plain", text);
  const beforeInputEvent = new InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    data: text,
    inputType: "insertFromPaste",
  });
  element.dispatchEvent(beforeInputEvent);
  const pasteEvent = new ClipboardEvent("paste", {
    bubbles: true,
    cancelable: true,
    clipboardData: data,
  });
  const pasteAccepted = element.dispatchEvent(pasteEvent);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertFromPaste" }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return pasteAccepted;
}

function nextclawPageActionPasteMatched(receiver, text, dom) {
  return dom.valueOf(receiver) === text || nextclawPageActionPageTextMatched(text);
}

function nextclawPageActionPageTextMatched(text) {
  if (text.length === 0) return false;
  const pageText = document.body?.innerText ?? "";
  if (pageText.includes(text)) return true;
  const meaningfulLines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  return meaningfulLines.length > 0 && meaningfulLines.every((line) => pageText.includes(line));
}

function nextclawPageActionClick(target, dom) {
  const { element, before } = dom.singleActionable(target);
  const beforeUrl = location.href;
  const beforeTitle = document.title;
  element.scrollIntoView({ block: "center", inline: "center" });
  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  return {
    action: "page.click",
    selector: target.selector,
    ref: target.ref,
    before,
    after: dom.inspectResolved(element, target),
    urlChanged: location.href !== beforeUrl,
    titleChanged: document.title !== beforeTitle,
  };
}

function nextclawPageActionSetChecked(target, checked, actionName, dom) {
  const { element, before } = dom.singleActionable(target);
  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute("role");
  if (tagName !== "input" && role !== "checkbox" && role !== "switch" && role !== "radio") {
    throw new Error("Element is not checkable.");
  }
  if ("checked" in element) {
    element.checked = checked;
  } else {
    element.setAttribute("aria-checked", checked ? "true" : "false");
  }
  nextclawPageActionDispatchInputEvents(element, String(checked));
  const after = dom.inspectResolved(element, target);
  return { action: actionName, selector: target.selector, ref: target.ref, before, after, element: after, changed: before.checked !== after.checked };
}

function nextclawPageActionSelect(target, dom) {
  const { element, before } = dom.singleActionable(target);
  if (element.tagName.toLowerCase() !== "select") {
    throw new Error("Element is not a select.");
  }
  const option = Array.from(element.options).find((candidate, index) => {
    if (typeof target.value === "string") return candidate.value === target.value;
    if (typeof target.label === "string") return candidate.label === target.label || candidate.textContent?.trim() === target.label;
    return Number.isInteger(target.index) && index === target.index;
  });
  if (!option) {
    throw new Error("Select option not found.");
  }
  element.value = option.value;
  nextclawPageActionDispatchInputEvents(element, option.value);
  const after = dom.inspectResolved(element, target);
  return { action: "page.select", selector: target.selector, ref: target.ref, before, after, element: after, changed: before.value !== after.value };
}

function nextclawPageActionPress(keys, dom) {
  const key = String(keys);
  document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  document.activeElement?.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
  return {
    action: "page.press",
    element: document.activeElement
      ? dom.inspectResolved(document.activeElement, { selector: undefined })
      : undefined,
  };
}

function nextclawPageActionWaitUrl(payload) {
  const url = String(payload.url ?? "");
  return nextclawPageActionWaitFor(
    () => location.href.includes(url),
    payload.timeoutMs,
    { action: "page.wait-url", urlMatched: url },
    `Timed out waiting for URL: ${url}`,
  );
}

function nextclawPageActionWaitLoad(payload) {
  const state = String(payload.state || "complete");
  return nextclawPageActionWaitFor(
    () => document.readyState === state || (payload.state === "load" && document.readyState === "complete"),
    payload.timeoutMs,
    { action: "page.wait-load", loadState: document.readyState },
    `Timed out waiting for load state: ${state}`,
  );
}

async function nextclawPageActionWaitElement(target, dom) {
  const timeoutMs = Number(target.timeoutMs ?? 5000);
  const targetForInspection = { ...target, selector: target.selector || "body" };
  return nextclawPageActionWaitFor(() => {
    const inspected = dom.inspectTarget(targetForInspection);
    const textMatches = target.text
      ? (document.body?.innerText ?? "").includes(String(target.text))
      : true;
    return inspected.count > 0 && inspected.visible !== false && textMatches;
  }, timeoutMs, {
    action: "page.wait-element",
    element: dom.inspectTarget(targetForInspection),
    textMatched: target.text,
  }, "Timed out waiting for element.");
}

function nextclawPageActionDispatchInputEvents(element, data) {
  element.dispatchEvent(new InputEvent("input", { bubbles: true, data }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

async function nextclawPageActionWaitFor(predicate, timeoutMs, result, message) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < Number(timeoutMs ?? 5000)) {
    if (predicate()) return typeof result === "function" ? result() : result;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(message);
}

function nextclawPageActionInstallLogs() {
  if (window.__browserConnectorLogs) {
    return { action: "page.logs.install", installed: true };
  }
  const logs = [];
  const push = (level, args) => {
    logs.push({
      level,
      message: args.map(nextclawPageActionFormatLogValue).join(" "),
      timestamp: new Date().toISOString(),
      url: location.href,
    });
    if (logs.length > NEXTCLAW_PAGE_ACTION_LOG_LIMIT) logs.splice(0, logs.length - NEXTCLAW_PAGE_ACTION_LOG_LIMIT);
  };
  window.__browserConnectorLogs = logs;
  for (const level of ["debug", "info", "log", "warn", "error"]) {
    const original = console[level]?.bind(console);
    console[level] = (...args) => {
      push(level, args);
      original?.(...args);
    };
  }
  window.addEventListener("error", (event) => push("error", [event.message]));
  window.addEventListener("unhandledrejection", (event) => push("error", [event.reason]));
  return { action: "page.logs.install", installed: true };
}

function nextclawPageActionReadLogs(options) {
  const logs = Array.isArray(window.__browserConnectorLogs) ? window.__browserConnectorLogs : [];
  const level = typeof options.level === "string" ? options.level : undefined;
  const limit = Math.max(1, Math.min(Number(options.limit ?? 20), NEXTCLAW_PAGE_ACTION_LOG_LIMIT));
  return { action: "page.logs", logs: logs.filter((entry) => !level || entry.level === level).slice(-limit) };
}

function nextclawPageActionFormatLogValue(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

globalThis.__nextclawBrowserConnectorRunPageAction = nextclawRunPageAction;
