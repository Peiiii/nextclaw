export type PanelAppManifest = {
  title?: string;
  description?: string;
  icon?: string;
};

export function parsePanelAppManifest(html: string): PanelAppManifest {
  return {
    ...readHtmlTitle(html),
    ...readPanelAppMeta(html),
  };
}

function readPanelAppMeta(html: string): PanelAppManifest {
  return {
    ...readPanelAppMetaField(html, "title"),
    ...readPanelAppMetaField(html, "description"),
    ...readPanelAppMetaField(html, "icon"),
  };
}

function readPanelAppMetaField(html: string, field: keyof PanelAppManifest): PanelAppManifest {
  const content = readMetaContent(html, `nextclaw-panel-${field}`);
  const manifest: PanelAppManifest = {};
  if (content) {
    manifest[field] = content;
  }
  return manifest;
}

function readHtmlTitle(html: string): PanelAppManifest {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = normalizeManifestValue(match?.[1]);
  return title ? { title } : {};
}

function readMetaContent(html: string, name: string): string | undefined {
  const metaTags = html.matchAll(/<meta\s+([^>]*?)>/gi);
  for (const tag of metaTags) {
    const attributes = tag[1] ?? "";
    if (readHtmlAttribute(attributes, "name") === name) {
      return normalizeManifestValue(readHtmlAttribute(attributes, "content"));
    }
  }
  return undefined;
}

function readHtmlAttribute(attributes: string, attribute: string): string | undefined {
  const match = attributes.match(new RegExp(`(?:^|\\s)${attribute}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2] ? decodeHtmlAttribute(match[2]) : undefined;
}

function normalizeManifestValue(value: string | undefined): string | undefined {
  const normalized = decodeHtmlAttribute(value ?? "").replace(/\s+/g, " ").trim();
  return normalized || undefined;
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
