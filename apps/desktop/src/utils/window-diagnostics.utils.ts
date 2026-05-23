import type { BrowserWindow } from "electron";
import type { DesktopLogger } from "./desktop-logging.utils";

const DESKTOP_TITLEBAR_HIT_TEST_SCRIPT = String.raw`
new Promise((resolve) => {
  window.setTimeout(() => {
    const describeElement = (element) => {
      if (!element) return null;
      const style = window.getComputedStyle(element);
      return { tag: element.tagName, id: element.id || "", className: String(element.className || ""), testId: element.getAttribute("data-testid") || "", appRegion: style.getPropertyValue("app-region") || "", webkitAppRegion: style.getPropertyValue("-webkit-app-region") || "", pointerEvents: style.pointerEvents || "" };
    };
    resolve({ points: [260, 320, 400, 700].map((x) => ({ x, y: 24, element: describeElement(document.elementFromPoint(x, 24)) })) });
  }, 800);
});
`;

export function attachWindowDiagnostics(window: BrowserWindow, logger: DesktopLogger): void {
  const webContents = window.webContents;
  const prefix = `[window:${webContents.id}]`;
  const logInfo = (message: string) => logger.info(`${prefix} ${message}`);
  const logWarn = (message: string) => logger.warn(`${prefix} ${message}`);

  webContents.on("dom-ready", () => {
    if (process.platform === "win32" && process.env.NEXTCLAW_DESKTOP_SMOKE_TITLEBAR_HIT_TEST === "1") {
      void webContents
        .executeJavaScript(DESKTOP_TITLEBAR_HIT_TEST_SCRIPT, true)
        .then((result) => logInfo(`titlebar-hit-test ${JSON.stringify(result)}`))
        .catch((error) => logWarn(`titlebar-hit-test-failed ${String(error)}`));
    }
  });
}
