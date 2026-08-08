import {
  PANEL_APP_INLINE_HOST_CONTRACT,
  PANEL_APP_SCROLL_RESTORATION_CONTRACT,
  readInlineContentHeight,
} from "@nextclaw/shared";
import { getUiContentParamsBootstrapScript } from "@kernel/utils/ui-content-params-injection.utils.js";

const PANEL_APP_BRIDGE_MARKER = "nextclaw:panel-app-service-actions:request";

function getPanelAppInlineContentHeightReporterScript(): string {
  return `
  function installInlineContentHeightReporter() {
    const inlineHostContract = ${JSON.stringify(PANEL_APP_INLINE_HOST_CONTRACT)};
    const readInlineContentHeight = ${readInlineContentHeight.toString()};
    if (!window.location || !window.document) {
      return;
    }
    const searchParams = new URLSearchParams(window.location.search);
    if (
      searchParams.get(inlineHostContract.displayModeSearchParam) !== inlineHostContract.displayMode ||
      searchParams.get(inlineHostContract.placementSearchParam) !== inlineHostContract.placement
    ) {
      return;
    }
    const start = () => {
      const { body, documentElement } = window.document;
      if (!documentElement) {
        return;
      }
      let lastHeight = 0;
      const reportHeight = () => {
        const height = readInlineContentHeight(body, documentElement);
        if (height > 0 && height !== lastHeight) {
          lastHeight = height;
          window.parent.postMessage({ type: inlineHostContract.contentHeightMessageType, height }, "*");
        }
      };
      if (typeof window.ResizeObserver === "function") {
        const observer = new window.ResizeObserver(reportHeight);
        observer.observe(documentElement);
        if (body) {
          observer.observe(body);
        }
      }
      window.addEventListener("load", reportHeight);
      reportHeight();
    };
    if (window.document.readyState === "loading") {
      window.document.addEventListener("DOMContentLoaded", start, { once: true });
      return;
    }
    start();
  }`.trim();
}

function getPanelAppScrollSurfaceHelpersScript(): string {
  return `
    function readScrollPosition(element) {
      const x = element ? element.scrollLeft : window.scrollX;
      const y = element ? element.scrollTop : window.scrollY;
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) {
        return null;
      }
      return { x, y };
    }

    function getScrollSurface(target) {
      const root = window.document.scrollingElement;
      if (
        !target ||
        target === window.document ||
        target === root ||
        target === window.document.documentElement ||
        target === window.document.body
      ) {
        return { kind: "document" };
      }
      if (!target.parentElement || !target.children || typeof target.scrollTop !== "number") {
        return null;
      }
      const path = [];
      let element = target;
      while (element && element !== window.document.body) {
        const parent = element.parentElement;
        if (!parent || !parent.children) {
          return null;
        }
        const index = Array.prototype.indexOf.call(parent.children, element);
        const tagName = typeof element.tagName === "string" ? element.tagName.toLowerCase() : "";
        if (index < 0 || !tagName) {
          return null;
        }
        path.unshift({ index, tagName });
        element = parent;
      }
      return element === window.document.body && path.length > 0 ? { kind: "element", path } : null;
    }

    function resolveScrollSurface(target) {
      if (target.kind === "document") {
        return null;
      }
      let element = window.document.body;
      for (const segment of target.path) {
        const child = element?.children?.[segment.index];
        if (!child || child.tagName?.toLowerCase() !== segment.tagName) {
          return undefined;
        }
        element = child;
      }
      return element;
    }

    function isScrollTarget(value) {
      if (!value || typeof value !== "object") {
        return false;
      }
      if (value.kind === "document") {
        return true;
      }
      return value.kind === "element" &&
        Array.isArray(value.path) &&
        value.path.length > 0 &&
        value.path.length <= 30 &&
        value.path.every((segment) =>
          segment &&
          Number.isInteger(segment.index) &&
          segment.index >= 0 &&
          segment.index <= 1000 &&
          typeof segment.tagName === "string" &&
          segment.tagName.length > 0 &&
          segment.tagName.length <= 32
        );
    }`.trim();
}

function getPanelAppScrollRestorationScript(): string {
  return `
  function installScrollRestoration() {
    const scrollContract = ${JSON.stringify(PANEL_APP_SCROLL_RESTORATION_CONTRACT)};
    const inlineHostContract = ${JSON.stringify(PANEL_APP_INLINE_HOST_CONTRACT)};
    const searchParams = new URLSearchParams(window.location.search);
    if (
      searchParams.get(inlineHostContract.displayModeSearchParam) === inlineHostContract.displayMode &&
      searchParams.get(inlineHostContract.placementSearchParam) === inlineHostContract.placement
    ) {
      return;
    }
    let isScrollReportScheduled = false;
    let latestScrollSurface = null;

    ${getPanelAppScrollSurfaceHelpersScript()}

    function reportScroll() {
      isScrollReportScheduled = false;
      const surface = latestScrollSurface;
      latestScrollSurface = null;
      if (!surface) {
        return;
      }
      const position = readScrollPosition(resolveScrollSurface(surface));
      if (!position) {
        return;
      }
      window.parent.postMessage({
        type: scrollContract.scrollMessageType,
        version: scrollContract.version,
        target: surface,
        ...position,
      }, "*");
    }

    function scheduleScrollReport(event) {
      const surface = getScrollSurface(event?.target);
      if (!surface) {
        return;
      }
      latestScrollSurface = surface;
      if (isScrollReportScheduled) {
        return;
      }
      isScrollReportScheduled = true;
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(reportScroll);
        return;
      }
      reportScroll();
    }

    function applyScrollPosition(target, x, y) {
      const element = resolveScrollSurface(target);
      if (element === undefined) {
        return false;
      }
      if (element && typeof element.scrollTo === "function") {
        element.scrollTo(x, y);
      } else if (element) {
        element.scrollLeft = x;
        element.scrollTop = y;
      } else {
        window.scrollTo(x, y);
      }
      const position = readScrollPosition(element);
      return position && Math.abs(position.x - x) <= 1 && Math.abs(position.y - y) <= 1;
    }

    function restoreScroll(target, x, y) {
      if (applyScrollPosition(target, x, y)) {
        return;
      }
      let resizeObserver;
      let mutationObserver;
      let timeoutId;
      const stop = () => {
        resizeObserver?.disconnect();
        mutationObserver?.disconnect();
        if (timeoutId !== undefined && typeof window.clearTimeout === "function") {
          window.clearTimeout(timeoutId);
        }
      };
      const retry = () => {
        if (applyScrollPosition(target, x, y)) {
          stop();
        }
      };
      if (typeof window.ResizeObserver === "function") {
        resizeObserver = new window.ResizeObserver(retry);
        resizeObserver.observe(window.document.documentElement);
        if (window.document.body) {
          resizeObserver.observe(window.document.body);
        }
      }
      if (typeof window.MutationObserver === "function" && window.document.body) {
        mutationObserver = new window.MutationObserver(retry);
        mutationObserver.observe(window.document.body, { childList: true, subtree: true });
      }
      if (typeof window.setTimeout === "function") {
        timeoutId = window.setTimeout(stop, 10000);
      }
    }

    if (typeof window.document.addEventListener === "function") {
      window.document.addEventListener("scroll", scheduleScrollReport, true);
    }
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (
        event.source !== window.parent ||
        !data ||
        data.type !== scrollContract.restoreScrollMessageType ||
        data.version !== scrollContract.version ||
        !isScrollTarget(data.target) ||
        !Number.isFinite(data.x) ||
        !Number.isFinite(data.y) ||
        data.x < 0 ||
        data.y < 0
      ) {
        return;
      }
      restoreScroll(data.target, data.x, data.y);
    });
  }`.trim();
}

export function injectPanelAppBridgeScript(
  html: string,
  params: {
    appId: string;
    runtimeToken: string;
  },
): string {
  if (html.includes(PANEL_APP_BRIDGE_MARKER)) {
    return html;
  }
  const script = `<script>${getPanelAppBridgeScript(params)}</script>`;
  const headMatch = /<head(?:\s[^>]*)?>/i.exec(html);
  if (headMatch?.index !== undefined) {
    const insertAt = headMatch.index + headMatch[0].length;
    return `${html.slice(0, insertAt)}${script}${html.slice(insertAt)}`;
  }
  return `${script}${html}`;
}

export function getPanelAppBridgeScript(
  params: {
    appId: string;
    runtimeToken: string;
  } = { appId: "", runtimeToken: "" },
): string {
  const appId = JSON.stringify(params.appId);
  const runtimeToken = JSON.stringify(params.runtimeToken);
  return `
${getUiContentParamsBootstrapScript()}
(() => {
  const requestType = "nextclaw:panel-app-service-actions:request";
  const responseType = "nextclaw:panel-app-service-actions:response";
  const appId = ${appId};
  const runtimeToken = ${runtimeToken};
  const pending = new Map();
  let counter = 0;

  function createRequestId() {
    counter += 1;
    return "panel-bridge-" + Date.now().toString(36) + "-" + counter.toString(36);
  }

  function request(method, payload) {
    const requestId = createRequestId();
    return new Promise((resolve, reject) => {
      pending.set(requestId, { method, resolve, reject });
      window.parent.postMessage({ type: requestType, requestId, appId, runtimeToken, method, payload }, "*");
    });
  }

  ${getPanelAppInlineContentHeightReporterScript()}
  ${getPanelAppScrollRestorationScript()}

  function resolveApiFetchUrl(input) {
    const raw = typeof input === "string" || input instanceof URL ? input.toString() : input?.url;
    if (typeof raw !== "string") {
      return null;
    }
    try {
      const url = new URL(raw, window.location.href);
      return url.origin === window.location.origin && url.pathname.startsWith("/api/") ? url : null;
    } catch {
      return null;
    }
  }

  function createFetchInitWithRuntimeToken(input, init) {
    if (!resolveApiFetchUrl(input)) {
      return init;
    }
    const headers = new Headers(init?.headers || (typeof input === "object" && input ? input.headers : undefined));
    if (!headers.has("x-nextclaw-panel-bridge-session")) {
      headers.set("x-nextclaw-panel-bridge-session", runtimeToken);
    }
    return { ...init, headers };
  }

  const nativeFetch = window.fetch?.bind(window);
  if (nativeFetch) {
    window.fetch = (input, init) => nativeFetch(input, createFetchInitWithRuntimeToken(input, init));
  }

  function unwrapServiceActionResult(result) {
    if (!result || typeof result !== "object") {
      return result;
    }
    if (Object.prototype.hasOwnProperty.call(result, "structuredContent") && result.structuredContent !== undefined) {
      return result.structuredContent;
    }
    const content = Array.isArray(result.content) ? result.content : undefined;
    if (content && content.length === 1 && content[0]?.type === "text" && typeof content[0].text === "string") {
      try {
        return JSON.parse(content[0].text);
      } catch {
        return content[0].text;
      }
    }
    return result;
  }

  function resolveBridgeData(entry, data) {
    if (entry.method === "list") {
      return Array.isArray(data.data?.actions) ? data.data.actions : [];
    }
    if (entry.method === "invoke") {
      return unwrapServiceActionResult(data.data?.result);
    }
    if (entry.method === "agent.generateObject") {
      return data.data?.result;
    }
    return data.data;
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.type !== responseType || typeof data.requestId !== "string") {
      return;
    }
    const entry = pending.get(data.requestId);
    if (!entry) {
      return;
    }
    pending.delete(data.requestId);
    if (data.ok) {
      entry.resolve(resolveBridgeData(entry, data));
      return;
    }
    const error = new Error(data.error?.message || "NextClaw panel bridge request failed.");
    error.code = data.error?.code;
    error.details = data.error?.details;
    entry.reject(error);
  });

  const existing = window.nextclaw && typeof window.nextclaw === "object" ? window.nextclaw : {};
  Object.defineProperty(window, "nextclaw", {
    configurable: true,
    value: {
      ...existing,
      serviceActions: {
        list: () => request("list", {}),
        invoke: (actionId, input) => request("invoke", { actionId, input }),
        requestGrant: (actionId) => request("requestGrant", { actionId }),
        revokeGrant: (actionId) => request("revokeGrant", { actionId })
      },
      agent: {
        send: (input) => request("agent.send", { request: input }),
        generateObject: (input) => request("agent.generateObject", { input })
      }
    }
  });
  installInlineContentHeightReporter();
  installScrollRestoration();
})();
`.trim();
}
