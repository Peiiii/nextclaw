const PANEL_APP_CLIENT_MARKER = "nextclaw:panel-app-client:init";
const PANEL_APP_CLIENT_SDK_PATH = "/api/panel-app-client-sdk.js";

export function injectPanelAppClientScript(html: string, params: {
  runtimeToken: string;
}): string {
  if (html.includes(PANEL_APP_CLIENT_MARKER)) {
    return html;
  }
  const script = [
    `<script src="${PANEL_APP_CLIENT_SDK_PATH}" crossorigin="anonymous"></script>`,
    `<script>${getPanelAppClientInitScript(params)}</script>`,
  ].join("");
  const headMatch = /<head(?:\s[^>]*)?>/i.exec(html);
  if (headMatch?.index !== undefined) {
    const insertAt = headMatch.index + headMatch[0].length;
    return `${html.slice(0, insertAt)}${script}${html.slice(insertAt)}`;
  }
  return `${script}${html}`;
}

function getPanelAppClientInitScript(params: { runtimeToken: string }): string {
  const runtimeToken = JSON.stringify(params.runtimeToken);
  return `
(() => {
  const marker = "${PANEL_APP_CLIENT_MARKER}";
  if (typeof window.NextClawClient !== "function") {
    console.error("[NextClaw] Panel App client SDK failed to load.");
    return;
  }
  if (typeof window.createNextClawAppClient !== "function") {
    console.error("[NextClaw] Panel App client projection failed to load.");
    return;
  }
  const existing = window.nextclaw && typeof window.nextclaw === "object" ? window.nextclaw : {};
  const hostClient = new window.NextClawClient({
    baseUrl: window.location.origin,
    headers: {
      "x-nextclaw-panel-bridge-session": ${runtimeToken}
    }
  });
  const client = window.createNextClawAppClient(hostClient);
  Object.defineProperty(window, "nextclaw", {
    configurable: true,
    value: {
      ...existing,
      client
    }
  });
  Object.defineProperty(window.nextclaw, "__clientInitMarker", {
    configurable: true,
    enumerable: false,
    value: marker
  });
})();
`.trim();
}
