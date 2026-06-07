import type { BrowserConnectorManager } from "@/managers/browser-connector.manager.js";
import { BrowserConnectorError } from "@/types/cli-output.types.js";
import type { BrowserConnectorCommandOutput } from "@/types/cli-output.types.js";

export type ClaimTabOptions = {
  reason?: string;
};

export type OpenTabOptions = {
  reason?: string;
  background?: boolean;
  foreground?: boolean;
};

export type CloseTabOptions = {
  reason?: string;
  confirmed?: boolean;
};

export class TabsController {
  constructor(private readonly browserConnectorManager: BrowserConnectorManager) {}

  list = async (): Promise<BrowserConnectorCommandOutput> => {
    const result = await this.browserConnectorManager.listTabs();

    return {
      ok: true,
      tabs: result.tabs,
    };
  };

  get = async (tabRef: string): Promise<BrowserConnectorCommandOutput> => ({
    ok: true,
    tab: await this.browserConnectorManager.getTab(tabRef),
  });

  selected = async (): Promise<BrowserConnectorCommandOutput> => ({
    ok: true,
    tab: await this.browserConnectorManager.selectedTab(),
  });

  open = async (
    url: string,
    options: OpenTabOptions,
  ): Promise<BrowserConnectorCommandOutput> => {
    const { background, foreground, reason } = options;

    if (!reason) {
      throw new BrowserConnectorError(
        "INVALID_ARGUMENT",
        "tabs open requires --reason.",
      );
    }
    if (background && foreground) {
      throw new BrowserConnectorError(
        "INVALID_ARGUMENT",
        "tabs open cannot use --background and --foreground together.",
      );
    }

    return {
      ok: true,
      tab: await this.browserConnectorManager.openTab(
        normalizeOpenableUrl(url),
        reason,
        { active: Boolean(foreground) },
      ),
    };
  };

  claim = async (
    tabRef: string,
    options: ClaimTabOptions,
  ): Promise<BrowserConnectorCommandOutput> => {
    if (!options.reason) {
      throw new BrowserConnectorError(
        "INVALID_ARGUMENT",
        "tabs claim requires --reason.",
      );
    }

    const lease = await this.browserConnectorManager.claimTab(
      tabRef,
      options.reason,
    );

    return {
      ok: true,
      lease,
    };
  };

  close = async (
    tabRef: string,
    options: CloseTabOptions,
  ): Promise<BrowserConnectorCommandOutput> => {
    if (!options.reason) {
      throw new BrowserConnectorError(
        "INVALID_ARGUMENT",
        "tabs close requires --reason.",
      );
    }

    return {
      ok: true,
      close: await this.browserConnectorManager.closeTab(
        tabRef,
        options.reason,
        options.confirmed ?? false,
      ),
    };
  };

  finalize = async (leaseId: string): Promise<BrowserConnectorCommandOutput> => ({
    ok: true,
    ...(await this.browserConnectorManager.finalizeTab(leaseId)),
  });
}

const normalizeOpenableUrl = (url: string): string => {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Unsupported protocol");
    }

    return parsed.toString();
  } catch {
    throw new BrowserConnectorError(
      "INVALID_ARGUMENT",
      "tabs open requires an http or https URL.",
    );
  }
};
