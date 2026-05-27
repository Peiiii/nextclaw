export type PanelAppManifest = {
  title?: string;
  description?: string;
  icon?: string;
  serviceActions: string[];
};

export function parsePanelAppManifest(html: string): PanelAppManifest {
  const fields = {
    ...readHtmlTitle(html),
    ...readStandardIcon(html),
    ...readPanelAppMeta(html),
  };
  return {
    ...fields,
    serviceActions: readPanelAppServiceActions(html),
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
  field: keyof Omit<PanelAppManifest, "serviceActions">,
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
