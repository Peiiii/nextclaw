import { execFile } from "node:child_process";
import { promisify } from "node:util";

export type BrowserSetupOpenResult = {
  opened: string[];
  warnings: string[];
};

export class BrowserSetupOpenerService {
  openChromeSetupTargets = async (
    extensionDir: string,
  ): Promise<BrowserSetupOpenResult> => {
    const opened: string[] = [];
    const warnings: string[] = [];

    await this.tryOpen("chrome://extensions", opened, warnings);
    await this.tryOpen(extensionDir, opened, warnings);

    return { opened, warnings };
  };

  private tryOpen = async (
    target: string,
    opened: string[],
    warnings: string[],
  ): Promise<void> => {
    try {
      await openTarget(target);
      opened.push(target);
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Failed to open ${target}: ${error.message}`
          : `Failed to open ${target}.`,
      );
    }
  };
}

const openTarget = async (target: string): Promise<void> => {
  if (process.platform === "darwin") {
    if (target === "chrome://extensions") {
      await execFileAsync("open", ["-a", "Google Chrome", target]);
      return;
    }

    await execFileAsync("open", [target]);
    return;
  }

  if (process.platform === "win32") {
    await execFileAsync("cmd", ["/c", "start", "", target]);
    return;
  }

  await execFileAsync("xdg-open", [target]);
};

const execFileAsync = promisify(execFile);
