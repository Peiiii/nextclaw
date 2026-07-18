import { PANEL_APP_INLINE_HOST_CONTRACT } from "@nextclaw/shared";

const PANEL_APP_BRIDGE_MARKER = "nextclaw:panel-app-service-actions:request";

function getPanelAppInlineContentHeightReporterScript(): string {
  return `
  function installInlineContentHeightReporter() {
    const inlineHostContract = ${JSON.stringify(PANEL_APP_INLINE_HOST_CONTRACT)};
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
        const height = Math.ceil(Math.max(
          body?.clientHeight || 0,
          body?.offsetHeight || 0,
          body?.scrollHeight || 0,
          documentElement.clientHeight || 0,
          documentElement.offsetHeight || 0,
          documentElement.scrollHeight || 0
        ));
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
})();
`.trim();
}
