import { UI_CONTENT_PARAMS_HOST_CONTRACT } from "@nextclaw/shared";

const UI_CONTENT_PARAMS_BOOTSTRAP_MARKER = "nextclaw:content-params:bootstrap";

export function getUiContentParamsBootstrapScript(): string {
  const contract = JSON.stringify(UI_CONTENT_PARAMS_HOST_CONTRACT);
  return `
/* ${UI_CONTENT_PARAMS_BOOTSTRAP_MARKER} */
(() => {
  const contract = ${contract};
  const rawWindowName = typeof window.name === "string" ? window.name : "";
  if (!rawWindowName.startsWith(contract.windowNamePrefix)) {
    return;
  }
  window.name = "";
  let params;
  try {
    params = JSON.parse(rawWindowName.slice(contract.windowNamePrefix.length));
  } catch {
    return;
  }
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return;
  }
  const freezeJson = (value) => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) {
      return value;
    }
    Object.values(value).forEach(freezeJson);
    return Object.freeze(value);
  };
  const existing = window.nextclaw && typeof window.nextclaw === "object"
    ? window.nextclaw
    : {};
  Object.defineProperty(window, "nextclaw", {
    configurable: true,
    value: {
      ...existing,
      params: freezeJson(params)
    }
  });
})();
`.trim();
}

export function injectUiContentParamsBootstrap(html: string): string {
  if (html.includes(UI_CONTENT_PARAMS_BOOTSTRAP_MARKER)) {
    return html;
  }
  const script = `<script>${getUiContentParamsBootstrapScript()}</script>`;
  const headMatch = /<head(?:\s[^>]*)?>/i.exec(html);
  if (headMatch?.index !== undefined) {
    const insertAt = headMatch.index + headMatch[0].length;
    return `${html.slice(0, insertAt)}${script}${html.slice(insertAt)}`;
  }
  return `${script}${html}`;
}
