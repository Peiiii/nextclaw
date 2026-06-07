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
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }
    const tagName = element.tagName.toLowerCase();
    const candidates = [
      attributeSelector(tagName, element, "data-testid"),
      attributeSelector(tagName, element, "data-test"),
      attributeSelector(tagName, element, "data-cy"),
      attributeSelector(tagName, element, "name"),
      attributeSelector(tagName, element, "aria-label"),
      attributeSelector(tagName, element, "placeholder"),
      attributeSelector(tagName, element, "href"),
    ].filter(Boolean);
    return candidates.find(isUniqueSelector) ?? cssPathFor(element);
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
  const collectNodes = (selector, limit) =>
    Array.from(document.querySelectorAll(selector))
      .slice(0, limit)
      .map((element) => {
        const stableSelector = selectorFor(element);
        return {
          selector: stableSelector,
          text: visibleText(element),
          ariaLabel: element.getAttribute("aria-label") ?? undefined,
          placeholder: element.getAttribute("placeholder") ?? undefined,
          role: element.getAttribute("role") ?? implicitRole(element),
          tagName: element.tagName.toLowerCase(),
          visible: isVisible(element),
          disabled: isDisabled(element),
          unique: isUniqueSelector(stableSelector),
        };
      });
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
    truncated: text.length > maxTextLength,
    warning: "untrusted-browser-page-content",
  };
}
