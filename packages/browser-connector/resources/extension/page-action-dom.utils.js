/* global document, window, location */

var NEXTCLAW_PAGE_ACTION_PREVIEW_LENGTH = 200;

function nextclawPageActionContextFor(target) {
  if (!target.frameSelector) return { document, window };
  const frame = document.querySelector(target.frameSelector);
  if (!frame?.contentDocument || !frame.contentWindow) {
    throw new Error(`Frame not accessible: ${target.frameSelector}`);
  }
  return { document: frame.contentDocument, window: frame.contentWindow };
}

function nextclawPageActionSelectorFor(element) {
  return nextclawPageActionSelectorCandidatesFor(element)[0] ?? element.tagName.toLowerCase();
}

function nextclawPageActionSelectorCandidatesFor(element) {
  const candidates = [];
  if (element.id) candidates.push(`#${nextclawPageActionEscapeIdentifier(element.id)}`);
  const tagName = element.tagName.toLowerCase();
  for (const attribute of ["data-testid", "data-test", "data-cy", "name", "aria-label", "placeholder", "href"]) {
    const value = element.getAttribute(attribute);
    if (value) candidates.push(`${tagName}[${attribute}="${nextclawPageActionQuote(value)}"]`);
  }
  candidates.push(nextclawPageActionCssPathFor(element));
  return Array.from(new Set(candidates));
}

function nextclawPageActionEscapeIdentifier(value) {
  return window.CSS?.escape ? window.CSS.escape(value) : String(value).replaceAll('"', '\\"');
}

function nextclawPageActionQuote(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function nextclawPageActionCssPathFor(element) {
  const parts = [];
  let current = element;
  while (current && current.nodeType === 1 && current !== document.body) {
    const tagName = current.tagName.toLowerCase();
    const siblings = Array.from(current.parentElement?.children ?? [])
      .filter((sibling) => sibling.tagName === current.tagName);
    const index = siblings.indexOf(current) + 1;
    parts.unshift(siblings.length > 1 ? `${tagName}:nth-of-type(${index})` : tagName);
    current = current.parentElement;
  }
  return parts.join(" > ") || element.tagName.toLowerCase();
}

function nextclawPageActionVisibleText(element) {
  const text = element.innerText || element.textContent || "";
  return text.trim().slice(0, NEXTCLAW_PAGE_ACTION_PREVIEW_LENGTH) || undefined;
}

function nextclawPageActionImplicitRole(element) {
  const tagName = element.tagName.toLowerCase();
  if (tagName === "button") return "button";
  if (tagName === "a" && element.getAttribute("href")) return "link";
  if (tagName === "input" || tagName === "textarea") return "textbox";
  if (tagName === "select") return "combobox";
  if (tagName === "iframe") return "frame";
  return undefined;
}

function nextclawPageActionKindFor(element) {
  const role = element.getAttribute("role") ?? nextclawPageActionImplicitRole(element);
  if (role) return role;
  if (element.tagName.toLowerCase() === "input") return element.getAttribute("type") ?? "input";
  return element.tagName.toLowerCase();
}

function nextclawPageActionHrefFor(element) {
  const href = element.getAttribute("href");
  try {
    return href ? new URL(href, location.href).toString() : undefined;
  } catch {
    return undefined;
  }
}

function nextclawPageActionBoundingBox(element) {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function nextclawPageActionIsVisible(element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

function nextclawPageActionIsDisabled(element) {
  return Boolean(element.disabled) || element.getAttribute("aria-disabled") === "true";
}

function nextclawPageActionIsEditable(element) {
  const tagName = element.tagName.toLowerCase();
  const inputType = element.getAttribute("type");
  return element.isContentEditable || tagName === "textarea" || tagName === "select" || (tagName === "input" && inputType !== "hidden");
}

function nextclawPageActionValueOf(element) {
  return "value" in element ? String(element.value ?? "") : String(element.textContent ?? "");
}

function nextclawPageActionCheckedOf(element) {
  if ("checked" in element) return Boolean(element.checked);
  const ariaChecked = element.getAttribute("aria-checked");
  return ariaChecked === null ? undefined : ariaChecked === "true";
}

function nextclawPageActionSelectedOf(element) {
  return "selected" in element ? Boolean(element.selected) : undefined;
}

function nextclawPageActionInspectResolved(element, target, count = 1) {
  const selector = target.selector ?? nextclawPageActionSelectorFor(element);
  const value = nextclawPageActionValueOf(element);
  const disabled = nextclawPageActionIsDisabled(element);
  return {
    count,
    unique: count === 1,
    ref: target.ref,
    elementId: target.ref,
    selector,
    selectorCandidates: nextclawPageActionSelectorCandidatesFor(element),
    text: nextclawPageActionVisibleText(element),
    ariaLabel: element.getAttribute("aria-label") ?? undefined,
    placeholder: element.getAttribute("placeholder") ?? undefined,
    role: element.getAttribute("role") ?? nextclawPageActionImplicitRole(element),
    kind: nextclawPageActionKindFor(element),
    tagName: element.tagName.toLowerCase(),
    inputType: element.getAttribute("type") ?? undefined,
    href: nextclawPageActionHrefFor(element),
    boundingBox: nextclawPageActionBoundingBox(element),
    visible: nextclawPageActionIsVisible(element),
    disabled,
    enabled: !disabled,
    editable: nextclawPageActionIsEditable(element),
    value: value || undefined,
    valueLength: value.length,
    checked: nextclawPageActionCheckedOf(element),
    selected: nextclawPageActionSelectedOf(element),
  };
}

function nextclawPageActionInspectTarget(target) {
  const context = nextclawPageActionContextFor(target);
  const selector = target.selector;
  if (typeof selector !== "string" || selector.length === 0) {
    throw new Error("Element selector is required.");
  }
  const elements = Array.from(context.document.querySelectorAll(selector));
  if (elements.length === 0) {
    return { count: 0, unique: false, selector, ref: target.ref, frameSelector: target.frameSelector };
  }
  return nextclawPageActionInspectResolved(elements[0], target, elements.length);
}

function nextclawPageActionSingleElement(target) {
  const context = nextclawPageActionContextFor(target);
  const selector = target.selector;
  if (typeof selector !== "string" || selector.length === 0) {
    throw new Error("Element selector is required.");
  }
  const elements = Array.from(context.document.querySelectorAll(selector));
  if (elements.length === 0) throw new Error(`Element not found: ${selector}`);
  if (elements.length > 1) throw new Error(`Element selector is ambiguous: ${selector}`);
  return {
    element: elements[0],
    inspection: nextclawPageActionInspectResolved(elements[0], target, elements.length),
  };
}

function nextclawPageActionSingleEditable(target) {
  const resolved = nextclawPageActionSingleElement(target);
  if (resolved.inspection.visible === false) throw new Error("Element is not visible.");
  if (resolved.inspection.enabled === false) throw new Error("Element is disabled.");
  if (!resolved.inspection.editable) throw new Error("Element is not editable.");
  return { element: resolved.element, before: resolved.inspection };
}

function nextclawPageActionSingleActionable(target) {
  const resolved = nextclawPageActionSingleElement(target);
  if (resolved.inspection.visible === false) throw new Error("Element is not visible.");
  if (resolved.inspection.enabled === false) throw new Error("Element is disabled.");
  return { element: resolved.element, before: resolved.inspection };
}

function nextclawPageActionSetNativeValue(element, value) {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
  if (descriptor?.set) {
    descriptor.set.call(element, value);
    return;
  }
  Reflect.set(element, "value", value);
}

function nextclawPageActionScrollState() {
  return {
    scrollX: Math.round(window.scrollX),
    scrollY: Math.round(window.scrollY),
    viewportWidth: Math.round(window.innerWidth),
    viewportHeight: Math.round(window.innerHeight),
    documentWidth: Math.round(document.documentElement.scrollWidth),
    documentHeight: Math.round(document.documentElement.scrollHeight),
  };
}

globalThis.__nextclawBrowserConnectorDom = {
  inspectTarget: nextclawPageActionInspectTarget,
  inspectResolved: nextclawPageActionInspectResolved,
  singleElement: nextclawPageActionSingleElement,
  singleEditable: nextclawPageActionSingleEditable,
  singleActionable: nextclawPageActionSingleActionable,
  setNativeValue: nextclawPageActionSetNativeValue,
  valueOf: nextclawPageActionValueOf,
  scrollState: nextclawPageActionScrollState,
  previewLength: NEXTCLAW_PAGE_ACTION_PREVIEW_LENGTH,
};
