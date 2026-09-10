import { createSystemObjectReferenceUri } from "@nextclaw/shared";
import type {
  DocBrowserRouteTarget,
  DocBrowserTab,
} from "@/shared/components/doc-browser/types/doc-browser.types";
import {
  buildSessionPath,
  parseSessionKeyFromPanelUrl,
} from "@/features/chat";
import { readPanelAppIdFromTab } from "./right-panel-resource-uri.utils";
import type { PageResource } from "@/features/right-panel-resources/types/page-resource.types";

export function pageResourceFromTarget(
  target: DocBrowserRouteTarget,
): PageResource {
  const uri = target.resourceUri ?? target.url;
  const sessionKey = parseSessionKeyFromPanelUrl(uri);
  const appId = readPanelAppIdFromTab({
    resourceUri: uri,
    currentUrl: target.url,
  });
  return {
    uri,
    title: target.title,
    target,
    ...(target.kind === "route"
      ? { mainPath: target.url }
      : sessionKey
        ? { mainPath: buildSessionPath(sessionKey) }
        : appId
          ? { mainPath: `/apps/panel/${encodeURIComponent(appId)}` }
          : {}),
  };
}

export function pageResourceFromTab(tab: DocBrowserTab): PageResource {
  return pageResourceFromTarget({
    ...tab,
    url: tab.currentUrl,
    historyPolicy: "managed",
  });
}

export function pageResourceMainPath(page: PageResource): string {
  return page.mainPath ?? `/resource?uri=${encodeURIComponent(page.uri)}`;
}

export function pageResourceFromSystemObject(
  objectType: string,
  objectId: string,
  title: string,
): PageResource {
  const uri = createSystemObjectReferenceUri(objectType, objectId);
  return pageResourceFromTarget({
    kind: "system-object",
    title,
    url: uri,
    resourceUri: uri,
    historyPolicy: "none",
  });
}
