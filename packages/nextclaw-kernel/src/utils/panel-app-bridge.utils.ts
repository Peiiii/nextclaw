const PANEL_APP_BRIDGE_SCRIPT_PATH = "/api/panel-app-bridge.js";

export function injectPanelAppBridgeScript(html: string): string {
  if (html.includes(PANEL_APP_BRIDGE_SCRIPT_PATH)) {
    return html;
  }
  const script = `<script src="${PANEL_APP_BRIDGE_SCRIPT_PATH}"></script>`;
  const headMatch = /<head(?:\s[^>]*)?>/i.exec(html);
  if (headMatch?.index !== undefined) {
    const insertAt = headMatch.index + headMatch[0].length;
    return `${html.slice(0, insertAt)}${script}${html.slice(insertAt)}`;
  }
  return `${script}${html}`;
}

export function getPanelAppBridgeScript(): string {
  return `
(() => {
  const requestType = "nextclaw:panel-app-service-actions:request";
  const responseType = "nextclaw:panel-app-service-actions:response";
  const pending = new Map();
  let counter = 0;

  function createRequestId() {
    counter += 1;
    return "panel-bridge-" + Date.now().toString(36) + "-" + counter.toString(36);
  }

  function request(method, payload) {
    const requestId = createRequestId();
    return new Promise((resolve, reject) => {
      pending.set(requestId, { resolve, reject });
      window.parent.postMessage({ type: requestType, requestId, method, payload }, "*");
    });
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
      entry.resolve(data.data);
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
      }
    }
  });
})();
`.trim();
}
