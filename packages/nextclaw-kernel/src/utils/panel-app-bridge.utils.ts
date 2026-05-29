const PANEL_APP_BRIDGE_MARKER = "nextclaw:panel-app-service-actions:request";

export function injectPanelAppBridgeScript(html: string): string {
  if (html.includes(PANEL_APP_BRIDGE_MARKER)) {
    return html;
  }
  const script = `<script>${getPanelAppBridgeScript()}</script>`;
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
      pending.set(requestId, { method, resolve, reject });
      window.parent.postMessage({ type: requestType, requestId, method, payload }, "*");
    });
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
})();
`.trim();
}
