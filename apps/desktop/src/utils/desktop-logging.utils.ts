import { app } from "electron";
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { resolveDesktopDataDir, resolveDesktopRuntimeHome } from "./desktop-paths.utils";

export type DesktopLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

function resolveDesktopStartupLogPath(): string {
  try {
    return join(resolveDesktopDataDir(), "launcher", "main.log");
  } catch {
    const home = homedir();
    if (process.platform === "darwin") {
      return join(home, "Library", "Application Support", "@nextclaw", "desktop", "launcher", "main.log");
    }
    if (process.platform === "win32") {
      const appData = process.env.APPDATA?.trim();
      return join(appData ? resolve(appData) : join(home, "AppData", "Roaming"), "@nextclaw", "desktop", "launcher", "main.log");
    }
    const configHome = process.env.XDG_CONFIG_HOME?.trim();
    return join(configHome ? resolve(configHome) : join(home, ".config"), "@nextclaw", "desktop", "launcher", "main.log");
  }
}

function writeDesktopLog(level: "INFO" | "WARN" | "ERROR", message: string): void {
  const formattedMessage = `[desktop] ${message}`;
  const timestamp = new Date().toISOString();
  try {
    const startupLogPath = resolveDesktopStartupLogPath();
    mkdirSync(dirname(startupLogPath), { recursive: true });
    appendFileSync(startupLogPath, `[${timestamp}] [${level}] ${formattedMessage}\n`, "utf8");
  } catch {
    // Keep desktop startup predictable even if file logging is unavailable.
  }

  try {
    const logsDir = app.getPath("logs");
    mkdirSync(logsDir, { recursive: true });
    appendFileSync(join(logsDir, "main.log"), `[${timestamp}] [${level}] ${formattedMessage}\n`, "utf8");
  } catch {
    // Keep desktop startup predictable even if file logging is unavailable.
  }

  if (level === "ERROR") {
    console.error(formattedMessage);
    return;
  }
  if (level === "WARN") {
    console.warn(formattedMessage);
    return;
  }
  console.log(formattedMessage);
}

export function createDesktopLogger(): DesktopLogger {
  return {
    info: (message: string) => writeDesktopLog("INFO", message),
    warn: (message: string) => writeDesktopLog("WARN", message),
    error: (message: string) => writeDesktopLog("ERROR", message)
  };
}

export function installDesktopProcessErrorLogging(logger: DesktopLogger): void {
  process.on("uncaughtException", (error) => {
    logger.error(`uncaughtException: ${error.stack ?? String(error)}`);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error(`unhandledRejection: ${String(reason)}`);
  });
}

export function logDesktopMainEntryLoaded(logger: DesktopLogger): void {
  logger.info(
    [
      "Desktop main entry loaded.",
      `pid=${process.pid}`,
      `packaged=${String(app.isPackaged)}`,
      `platform=${process.platform}`,
      `arch=${process.arch}`,
      `runtimeHome=${resolveDesktopRuntimeHome()}`,
      `desktopDataDir=${resolveDesktopDataDir()}`,
      `ambientNextclawHome=${process.env.NEXTCLAW_HOME?.trim() || ""}`,
      `ambientDesktopDataDir=${process.env.NEXTCLAW_DESKTOP_DATA_DIR?.trim() || ""}`
    ].join(" ")
  );
}
