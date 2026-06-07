/* global chrome */

export function assertWebUrl(url, command, createError) {
  if (typeof url !== "string" || url.length === 0) {
    throw createError("INVALID_ARGUMENT", `${command} requires url.`, false);
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Unsupported protocol");
    }
    return parsed.toString();
  } catch {
    throw createError(
      "INVALID_ARGUMENT",
      `${command} requires an http or https URL.`,
      false,
    );
  }
}

export async function waitForTabReady(tabId, timeoutMs, createError) {
  const startedAt = Date.now();
  let latest = await chrome.tabs.get(tabId);

  while (Date.now() - startedAt < timeoutMs) {
    latest = await chrome.tabs.get(tabId);
    if ((latest.url || latest.pendingUrl) && latest.status === "complete") {
      return latest;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  if (latest.url || latest.pendingUrl || latest.title) {
    return latest;
  }

  throw createError(
    "NAVIGATION_TIMEOUT",
    `Timed out waiting for Chrome tab to load: chrome-tab:${tabId}`,
  );
}

export function toBrowserTabInfo(tab) {
  return {
    tabRef: `chrome-tab:${tab.id}`,
    title: tab.title ?? "",
    url: redactUrl(tab.url ?? ""),
    active: Boolean(tab.active),
    windowId: tab.windowId,
    lastAccessed: tab.lastAccessed,
    status: tab.status,
    pendingUrl: tab.pendingUrl ? redactUrl(tab.pendingUrl) : undefined,
  };
}

function redactUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname
      .split("/")
      .map(redactPathSegment)
      .join("/");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function redactPathSegment(segment) {
  if (/^sid_[A-Za-z0-9_-]+$/.test(segment)) {
    return "sid_redacted";
  }

  return segment;
}
