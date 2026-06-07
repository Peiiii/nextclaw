/* global document, location, window, CSS */

export function collectPageSnapshot(maxTextLength) {
  const redactPathSegment = (segment) => {
    if (/^sid_[A-Za-z0-9_-]+$/.test(segment)) {
      return "sid_redacted";
    }

    return segment;
  };
  const redactPageUrl = (url) => {
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
  };
  const isUniqueSelector = (selector) => {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  };
  const quotedAttribute = (value) =>
    String(value).replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
  const attributeSelector = (tagName, element, attributeName) => {
    const value = element.getAttribute(attributeName);
    return value ? `${tagName}[${attributeName}="${quotedAttribute(value)}"]` : undefined;
  };
  const cssPathFor = (element) => {
    const parts = [];
    let current = element;
    while (current && current.nodeType === 1 && current !== document.body) {
      const tagName = current.tagName.toLowerCase();
      const siblings = Array.from(current.parentElement?.children ?? [])
        .filter((sibling) => sibling.tagName === current.tagName);
      const index = siblings.indexOf(current) + 1;
      parts.unshift(siblings.length > 1 ? `${tagName}:nth-of-type(${index})` : tagName);
      const selector = parts.join(" > ");
      if (isUniqueSelector(selector)) {
        return selector;
      }
      current = current.parentElement;
    }
    return parts.join(" > ") || element.tagName.toLowerCase();
  };
  const selectorFor = (element) => {
    const candidates = selectorCandidatesFor(element);
    return candidates.find(isUniqueSelector) ?? candidates[0] ?? element.tagName.toLowerCase();
  };
  const selectorCandidatesFor = (element) => {
    const candidates = [];
    if (element.id) {
      candidates.push(`#${CSS.escape(element.id)}`);
    }
    const tagName = element.tagName.toLowerCase();
    candidates.push(...[
      attributeSelector(tagName, element, "data-testid"),
      attributeSelector(tagName, element, "data-test"),
      attributeSelector(tagName, element, "data-cy"),
      attributeSelector(tagName, element, "name"),
      attributeSelector(tagName, element, "aria-label"),
      attributeSelector(tagName, element, "placeholder"),
      attributeSelector(tagName, element, "href"),
    ].filter(Boolean));
    candidates.push(cssPathFor(element));
    return Array.from(new Set(candidates));
  };
  const visibleText = (element) => {
    const elementText = element.innerText || element.textContent || "";
    return elementText.trim().slice(0, 200) || undefined;
  };
  const implicitRole = (element) => {
    const tagName = element.tagName.toLowerCase();
    if (tagName === "button") return "button";
    if (tagName === "a" && element.getAttribute("href")) return "link";
    if (tagName === "input" || tagName === "textarea") return "textbox";
    if (tagName === "select") return "combobox";
    return undefined;
  };
  const isVisible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };
  const isDisabled = (element) =>
    Boolean(element.disabled) || element.getAttribute("aria-disabled") === "true";
  const isEditable = (element) => {
    const tagName = element.tagName.toLowerCase();
    const inputType = element.getAttribute("type");
    return element.isContentEditable || tagName === "textarea" || tagName === "select" || (tagName === "input" && inputType !== "hidden");
  };
  const valueFor = (element) => "value" in element ? String(element.value ?? "") : "";
  const nodeFor = (element) => {
    const stableSelector = selectorFor(element);
    const value = valueFor(element);
    const disabled = isDisabled(element);
    return {
      selector: stableSelector,
      selectorCandidates: selectorCandidatesFor(element),
      text: visibleText(element),
      ariaLabel: element.getAttribute("aria-label") ?? undefined,
      placeholder: element.getAttribute("placeholder") ?? undefined,
      role: element.getAttribute("role") ?? implicitRole(element),
      tagName: element.tagName.toLowerCase(),
      visible: isVisible(element),
      disabled,
      enabled: !disabled,
      editable: isEditable(element),
      value: value || undefined,
      valueLength: value.length,
      unique: isUniqueSelector(stableSelector),
    };
  };
  const collectNodes = (selector, limit) =>
    Array.from(document.querySelectorAll(selector))
      .slice(0, limit)
      .map((element) => nodeFor(element));
  const text = document.body?.innerText ?? "";
  let safeUrl = location.href;
  try {
    const parsed = new URL(location.href);
    parsed.search = "";
    parsed.hash = "";
    safeUrl = parsed.toString();
  } catch {
    safeUrl = location.href;
  }
  return {
    title: document.title,
    url: redactPageUrl(safeUrl),
    text: text.slice(0, maxTextLength),
    links: collectNodes("a[href]", 50),
    buttons: collectNodes("button,[role='button'],input[type='button'],input[type='submit']", 50),
    inputs: collectNodes("input,textarea,select", 50),
    frames: collectNodes("iframe", 25),
    interactive: [],
    truncated: text.length > maxTextLength,
    warning: "untrusted-browser-page-content",
  };
}

export function collectInteractiveNodes() {
  const isUniqueSelector = (selector) => {
    try { return document.querySelectorAll(selector).length === 1; } catch { return false; }
  };
  const quotedAttribute = (value) =>
    String(value).replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
  const attributeSelector = (tagName, element, attributeName) => {
    const value = element.getAttribute(attributeName);
    return value ? `${tagName}[${attributeName}="${quotedAttribute(value)}"]` : undefined;
  };
  const cssPathFor = (element) => {
    const parts = [];
    let current = element;
    while (current && current.nodeType === 1 && current !== document.body) {
      const tagName = current.tagName.toLowerCase();
      const siblings = Array.from(current.parentElement?.children ?? [])
        .filter((sibling) => sibling.tagName === current.tagName);
      const index = siblings.indexOf(current) + 1;
      parts.unshift(siblings.length > 1 ? `${tagName}:nth-of-type(${index})` : tagName);
      const selector = parts.join(" > ");
      if (isUniqueSelector(selector)) {
        return selector;
      }
      current = current.parentElement;
    }
    return parts.join(" > ") || element.tagName.toLowerCase();
  };
  const selectorFor = (element) => {
    const candidates = selectorCandidatesFor(element);
    return candidates.find(isUniqueSelector) ?? candidates[0] ?? element.tagName.toLowerCase();
  };
  const selectorCandidatesFor = (element) => {
    const candidates = [];
    if (element.id) {
      candidates.push(`#${CSS.escape(element.id)}`);
    }
    const tagName = element.tagName.toLowerCase();
    candidates.push(...[
      attributeSelector(tagName, element, "data-testid"),
      attributeSelector(tagName, element, "data-test"),
      attributeSelector(tagName, element, "data-cy"),
      attributeSelector(tagName, element, "name"),
      attributeSelector(tagName, element, "aria-label"),
      attributeSelector(tagName, element, "placeholder"),
      attributeSelector(tagName, element, "href"),
    ].filter(Boolean));
    candidates.push(cssPathFor(element));
    return Array.from(new Set(candidates));
  };
  const visibleText = (element) => {
    const elementText = element.innerText || element.textContent || "";
    return elementText.trim().slice(0, 200) || undefined;
  };
  const implicitRole = (element) => {
    const tagName = element.tagName.toLowerCase();
    if (tagName === "button") return "button";
    if (tagName === "a" && element.getAttribute("href")) return "link";
    if (tagName === "input" || tagName === "textarea") return "textbox";
    if (tagName === "select") return "combobox";
    return undefined;
  };
  const isVisible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };
  const isDisabled = (element) => Boolean(element.disabled) || element.getAttribute("aria-disabled") === "true";
  const isEditable = (element) => {
    const tagName = element.tagName.toLowerCase();
    const inputType = element.getAttribute("type");
    return element.isContentEditable || tagName === "textarea" || tagName === "select" || (tagName === "input" && inputType !== "hidden");
  };
  const valueFor = (element) => "value" in element ? String(element.value ?? "") : "";
  const boundingBox = (element) => {
    const rect = element.getBoundingClientRect();
    return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
  };
  const redactPageUrl = (url) => {
    try {
      const parsed = new URL(url);
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    } catch { return url; }
  };
  const hrefFor = (element) => {
    const href = element.getAttribute("href");
    try {
      return href ? redactPageUrl(new URL(href, location.href).toString()) : undefined;
    } catch { return undefined; }
  };
  const kindFor = (element) => {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute("role") ?? implicitRole(element);
    if (role) return role;
    if (tagName === "input") return element.getAttribute("type") ?? "input";
    return tagName;
  };
  const interactiveRoles = ["button", "link", "menuitem", "option", "switch", "checkbox", "radio", "tab", "textbox", "combobox"];
  const nativeTags = ["a", "button", "input", "textarea", "select", "summary"];
  const roleIsInteractive = (role) => interactiveRoles.includes(role);
  const explicitInteractiveSelector = nativeTags.concat(interactiveRoles.map((role) => `[role='${role}']`)).join(",");
  const isInteractiveCandidate = (element) => {
    if (!isVisible(element) || isDisabled(element) || element.getAttribute("aria-hidden") === "true") {
      return false;
    }
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute("role");
    const tabIndex = Number(element.getAttribute("tabindex"));
    const style = window.getComputedStyle(element);
    if (["svg", "path", "g", "circle", "rect"].includes(tagName)) {
      return false;
    }
    if (nativeTags.includes(tagName) || roleIsInteractive(role)) {
      return true;
    }

    const genericInteractive = element.hasAttribute("onclick") || (Number.isInteger(tabIndex) && tabIndex >= 0) || element.isContentEditable || style.cursor === "pointer";

    if (!genericInteractive || element.querySelector(explicitInteractiveSelector) || element.parentElement?.closest(explicitInteractiveSelector)) {
      return false;
    }

    const textLength = (element.innerText || element.textContent || "").trim().length;
    return textLength <= 120;
  };
  const nodeFor = (element, ref) => {
    const stableSelector = selectorFor(element);
    const value = valueFor(element);
    const disabled = isDisabled(element);
    return {
      ref, elementId: ref, selector: stableSelector, selectorCandidates: selectorCandidatesFor(element), text: visibleText(element),
      ariaLabel: element.getAttribute("aria-label") ?? undefined,
      placeholder: element.getAttribute("placeholder") ?? undefined,
      role: element.getAttribute("role") ?? implicitRole(element), kind: kindFor(element), tagName: element.tagName.toLowerCase(),
      inputType: element.getAttribute("type") ?? undefined,
      href: hrefFor(element), boundingBox: boundingBox(element), visible: isVisible(element),
      disabled, enabled: !disabled, editable: isEditable(element), value: value || undefined,
      valueLength: value.length, unique: isUniqueSelector(stableSelector),
    };
  };
  const candidates = [];
  for (const element of Array.from(document.querySelectorAll("body *"))) {
    if (!isInteractiveCandidate(element)) {
      continue;
    }
    candidates.push(nodeFor(element, `i${candidates.length + 1}`));
    if (candidates.length >= 250) {
      break;
    }
  }
  return candidates;
}
