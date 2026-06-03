export type PanelAppManifest = {
  id?: string;
  title?: string;
  description?: string;
  icon?: string;
  entry?: string;
  capabilities: string[];
  client: boolean;
  serviceActions: string[];
};

const PANEL_APP_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parsePanelAppManifest(html: string): PanelAppManifest {
  const fields = {
    ...readHtmlTitle(html),
    ...readStandardIcon(html),
    ...readPanelAppMeta(html),
  };
  return {
    ...fields,
    capabilities: readPanelAppCapabilities(html),
    client: false,
    serviceActions: readPanelAppServiceActions(html),
  };
}

export function parsePanelAppFolderManifest(raw: string): PanelAppManifest & {
  title: string;
  entry: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `panel-app.json is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (!isRecord(parsed)) {
    throw new Error("panel-app.json must contain an object.");
  }
  const id = readOptionalString(parsed, "id");
  if (id && !PANEL_APP_ID_PATTERN.test(id)) {
    throw new Error("panel app id must be kebab-case.");
  }
  return {
    id,
    title: readRequiredString(parsed, "title"),
    description: readOptionalString(parsed, "description"),
    icon: readOptionalString(parsed, "icon"),
    entry: readRequiredString(parsed, "entry"),
    capabilities: readStringArray(parsed.capabilities, "capabilities"),
    client: readOptionalBoolean(parsed, "client"),
    serviceActions: readStringArray(parsed.actions, "actions"),
  };
}

function readPanelAppMeta(html: string): Partial<PanelAppManifest> {
  return {
    ...readPanelAppMetaField(html, "title"),
    ...readPanelAppMetaField(html, "description"),
    ...readPanelAppMetaField(html, "icon"),
  };
}

function readPanelAppMetaField(
  html: string,
  field: keyof Pick<PanelAppManifest, "description" | "icon" | "title">,
): Partial<PanelAppManifest> {
  const content = readMetaContent(html, `nextclaw-panel-${field}`, field === "icon" ? "attribute" : "text");
  const manifest: Partial<PanelAppManifest> = {};
  if (content) {
    manifest[field] = content;
  }
  return manifest;
}

function readHtmlTitle(html: string): Partial<PanelAppManifest> {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = normalizeTextValue(match?.[1]);
  return title ? { title } : {};
}

function readStandardIcon(html: string): Partial<PanelAppManifest> {
  const icon = readLinkHref(html, (relTokens) => relTokens.includes("icon"));
  const appleTouchIcon = readLinkHref(html, (relTokens) =>
    relTokens.some((token) => token === "apple-touch-icon" || token === "apple-touch-icon-precomposed")
  );
  const href = normalizeIconHref(icon ?? appleTouchIcon);
  return href ? { icon: href } : {};
}

function readMetaContent(html: string, name: string, valueKind: "attribute" | "text"): string | undefined {
  const metaTags = html.matchAll(/<meta\s+([^>]*?)>/gi);
  for (const tag of metaTags) {
    const attributes = tag[1] ?? "";
    if (readHtmlAttribute(attributes, "name") === name) {
      const content = readHtmlAttribute(attributes, "content");
      return valueKind === "attribute"
        ? normalizeAttributeValue(content)
        : normalizeTextValue(content);
    }
  }
  return undefined;
}

function readLinkHref(html: string, matchesRel: (relTokens: string[]) => boolean): string | undefined {
  const linkTags = html.matchAll(/<link\s+([^>]*?)>/gi);
  for (const tag of linkTags) {
    const attributes = tag[1] ?? "";
    const relTokens = (readHtmlAttribute(attributes, "rel") ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (matchesRel(relTokens)) {
      return normalizeAttributeValue(readHtmlAttribute(attributes, "href"));
    }
  }
  return undefined;
}

function readHtmlAttribute(attributes: string, attribute: string): string | undefined {
  const match = attributes.match(new RegExp(`(?:^|\\s)${attribute}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2] ? decodeHtmlAttribute(match[2]) : undefined;
}

function readPanelAppServiceActions(html: string): string[] {
  const content = readMetaContent(html, "nextclaw-panel-actions", "attribute");
  return parseTokenList(content);
}

function readPanelAppCapabilities(html: string): string[] {
  const content = readMetaContent(html, "nextclaw-panel-capabilities", "attribute");
  return parseTokenList(content);
}

function parseTokenList(content: string | undefined): string[] {
  if (!content) {
    return [];
  }
  return [...new Set(
    content
      .split(/[,\s]+/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  )];
}

function readRequiredString(record: Record<string, unknown>, key: string): string {
  const value = readOptionalString(record, key);
  if (!value) {
    throw new Error(`panel app ${key} is required.`);
  }
  return value;
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  return typeof record[key] === "string" && record[key].trim()
    ? record[key].trim()
    : undefined;
}

function readOptionalBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean {
  const value = record[key];
  if (value === undefined) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw new Error(`panel app ${key} must be a boolean.`);
  }
  return value;
}

function readStringArray(value: unknown, key: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`panel app ${key} must be a string array.`);
  }
  return [...new Set(value.map((entry) => entry.trim()).filter(Boolean))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeTextValue(value: string | undefined): string | undefined {
  const normalized = decodeHtmlAttribute(value ?? "").replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function normalizeAttributeValue(value: string | undefined): string | undefined {
  const normalized = decodeHtmlAttribute(value ?? "").trim();
  return normalized || undefined;
}

function normalizeIconHref(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  if (
    value.startsWith("data:image/") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/")
  ) {
    return value;
  }
  return undefined;
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#34;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
