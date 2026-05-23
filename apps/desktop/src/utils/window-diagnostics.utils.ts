import type { BrowserWindow } from "electron";
import type { DesktopLogger } from "./desktop-logging.utils";

const DESKTOP_RENDERER_DEBUG_SCRIPT = String.raw`
(() => {
  const debugKey = "__nextclawDesktopDebugInstalled__";
  const targetPaths = ["/api/auth/status", "/api/config", "/api/ncp/sessions"];
  const normalizeUrl = (input) =>
    typeof input === "string" ? input : input?.url && typeof input.url === "string" ? input.url : "";
  const shouldTrace = (input) => targetPaths.some((path) => normalizeUrl(input).includes(path));

  if (!window[debugKey]) {
    window[debugKey] = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const url = normalizeUrl(args[0]);
      const trace = shouldTrace(url);
      if (trace) console.info("[desktop-debug] fetch:start " + url);
      try {
        const response = await originalFetch(...args);
        if (trace) console.info("[desktop-debug] fetch:done " + response.status + " " + url);
        return response;
      } catch (error) {
        if (trace) console.error("[desktop-debug] fetch:fail " + url + " " + String(error));
        throw error;
      }
    };

    window.addEventListener("error", (event) => {
      console.error("[desktop-debug] window:error " + String(event.message || "") + " at " + String(event.filename || "") + ":" + String(event.lineno || 0) + ":" + String(event.colno || 0));
    });

    window.addEventListener("unhandledrejection", (event) => {
      console.error("[desktop-debug] window:unhandledrejection " + String(event.reason));
    });
  }

  console.info("[desktop-debug] route " + window.location.href);
  return {
    href: window.location.href,
    title: document.title,
    readyState: document.readyState
  };
})();
`;

const DESKTOP_TITLEBAR_HIT_TEST_SCRIPT = String.raw`
new Promise((resolve) => {
  window.setTimeout(() => {
    const describeElement = (element) => {
      if (!element) return null;
      const style = window.getComputedStyle(element);
      return { tag: element.tagName, id: element.id || "", className: String(element.className || ""), testId: element.getAttribute("data-testid") || "", appRegion: style.getPropertyValue("app-region") || "", webkitAppRegion: style.getPropertyValue("-webkit-app-region") || "", pointerEvents: style.pointerEvents || "" };
    };
    const chrome = document.querySelector("[data-testid='desktop-window-chrome']");
    resolve({ href: window.location.href, innerWidth: window.innerWidth, innerHeight: window.innerHeight, devicePixelRatio: window.devicePixelRatio, chrome: chrome ? chrome.getBoundingClientRect().toJSON() : null, points: [260, 320, 400, 700].map((x) => ({ x, y: 24, element: describeElement(document.elementFromPoint(x, 24)) })) });
  }, 800);
});
`;

export function attachWindowDiagnostics(window: BrowserWindow, logger: DesktopLogger): void {
  const webContents = window.webContents;
  const prefix = `[window:${webContents.id}]`;
  const logInfo = (message: string) => logger.info(`${prefix} ${message}`);
  const logWarn = (message: string) => logger.warn(`${prefix} ${message}`);

  window.once("ready-to-show", () => {
    logInfo(`ready-to-show bounds=${JSON.stringify(window.getBounds())}`);
  });
  window.on("unresponsive", () => {
    logWarn("window became unresponsive");
  });
  window.on("responsive", () => {
    logInfo("window recovered responsiveness");
  });

  webContents.on("did-start-loading", () => {
    logInfo(`did-start-loading url=${webContents.getURL() || "about:blank"}`);
  });
  webContents.on("did-stop-loading", () => {
    logInfo(`did-stop-loading url=${webContents.getURL() || "about:blank"}`);
  });
  webContents.on("did-navigate", (_event, url) => {
    logInfo(`did-navigate url=${url}`);
  });
  webContents.on("did-navigate-in-page", (_event, url, isMainFrame) => {
    logInfo(`did-navigate-in-page url=${url} isMainFrame=${String(isMainFrame)}`);
  });
  webContents.on("did-finish-load", () => {
    logInfo(`did-finish-load url=${webContents.getURL() || "about:blank"} title=${webContents.getTitle() || ""}`);
  });
  webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    logWarn(
      [
        `did-fail-load code=${String(errorCode)}`,
        `description=${errorDescription}`,
        `url=${validatedURL}`,
        `isMainFrame=${String(isMainFrame)}`
      ].join(" ")
    );
  });
  webContents.on("render-process-gone", (_event, details) => {
    logWarn(`render-process-gone reason=${details.reason} exitCode=${String(details.exitCode)}`);
  });
  webContents.on("console-message", (_event, level, message, line, sourceId) => {
    logInfo(`renderer-console level=${String(level)} source=${sourceId}:${String(line)} message=${message}`);
  });
  webContents.on("dom-ready", () => {
    logInfo(`dom-ready url=${webContents.getURL() || "about:blank"}`);
    void webContents
      .executeJavaScript(DESKTOP_RENDERER_DEBUG_SCRIPT, true)
      .then((result) => {
        const summary =
          result && typeof result === "object"
            ? JSON.stringify(result)
            : String(result ?? "");
        logInfo(`renderer-debug-installed ${summary}`);
      })
      .catch((error) => {
        logWarn(`renderer-debug-install-failed ${String(error)}`);
      });

    if (process.platform === "win32" && process.env.NEXTCLAW_DESKTOP_SMOKE_TITLEBAR_HIT_TEST === "1") {
      void webContents
        .executeJavaScript(DESKTOP_TITLEBAR_HIT_TEST_SCRIPT, true)
        .then((result) => logInfo(`titlebar-hit-test ${JSON.stringify(result)}`))
        .catch((error) => logWarn(`titlebar-hit-test-failed ${String(error)}`));
    }
  });
}
