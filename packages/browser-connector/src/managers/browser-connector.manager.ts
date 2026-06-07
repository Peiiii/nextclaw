import { BrowserConnectorClient } from "@/services/browser-connector-client.service.js";
import { AuditRepository } from "@/repositories/audit.repository.js";
import { redactBrowserUrl } from "@/utils/url-redaction.utils.js";
import type { ConfigRepository } from "@/repositories/config.repository.js";
import type {
  BrowserActionResult,
  BrowserConnectorStatus,
  BrowserPageLocateResult,
  BrowserPageSnapshot,
  BrowserScreenshot,
  BrowserTabInfo,
  BrowserTabLease,
} from "@/types/browser-connector.types.js";

export type BrowserActionOptions = {
  leaseId: string;
  reason: string;
  selector?: string;
  ref?: string;
  url?: string;
  text?: string;
  keys?: string;
  x?: number;
  y?: number;
  timeoutMs?: number;
};

export type ScreenshotOptions = {
  includeDataUrl?: boolean;
};

export type SnapshotOptions = {
  interactive?: boolean;
};

export type OpenTabOptions = {
  active: boolean;
};

export class BrowserConnectorManager {
  constructor(private readonly configRepository: ConfigRepository) {}

  status = async (): Promise<BrowserConnectorStatus> => {
    const client = await this.createClient();
    return client.request("browser.status");
  };

  listTabs = async (): Promise<{ tabs: BrowserTabInfo[] }> => {
    const client = await this.createClient();
    return client.request("tabs.list");
  };

  getTab = async (tabRef: string): Promise<BrowserTabInfo> => {
    const client = await this.createClient();
    return client.request("tabs.get", { tabRef });
  };

  selectedTab = async (): Promise<BrowserTabInfo | undefined> => {
    const client = await this.createClient();
    return client.request("tabs.selected");
  };

  openTab = async (
    url: string,
    reason: string,
    options: OpenTabOptions,
  ): Promise<BrowserTabInfo> => {
    const auditRepository = await this.createAuditRepository();
    const client = await this.createClient();
    await auditRepository.appendEvent({
      command: "tabs.open",
      reason,
      url: redactBrowserUrl(url),
      at: new Date().toISOString(),
    });

    return client.request("tabs.open", { url, reason, active: options.active });
  };

  claimTab = async (
    tabRef: string,
    reason: string,
  ): Promise<BrowserTabLease> => {
    const auditRepository = await this.createAuditRepository();
    const client = await this.createClient();
    await auditRepository.appendEvent({
      command: "tabs.claim",
      reason,
      tabRef,
      at: new Date().toISOString(),
    });

    return client.request("tabs.claim", { tabRef, reason });
  };

  finalizeTab = async (
    leaseId: string,
  ): Promise<{ finalized: true; leaseId: string }> => {
    const auditRepository = await this.createAuditRepository();
    const client = await this.createClient();
    await auditRepository.appendEvent({
      command: "tabs.finalize",
      leaseId,
      at: new Date().toISOString(),
    });

    return client.request("tabs.finalize", { leaseId });
  };

  snapshotPage = async (
    leaseId: string,
    options: SnapshotOptions = {},
  ): Promise<BrowserPageSnapshot> => {
    const client = await this.createClient();
    return client.request("page.snapshot", {
      leaseId,
      interactive: options.interactive ?? false,
    });
  };

  locatePage = async (
    leaseId: string,
    text: string,
  ): Promise<BrowserPageLocateResult> => {
    const client = await this.createClient();
    return client.request("page.locate", { leaseId, text });
  };

  screenshotPage = async (
    leaseId: string,
    options: ScreenshotOptions = {},
  ): Promise<BrowserScreenshot> => {
    const client = await this.createClient();
    return client.request("page.screenshot", {
      leaseId,
      includeDataUrl: options.includeDataUrl ?? true,
    });
  };

  runPageAction = async (
    command:
      | "page.goto"
      | "page.reload"
      | "page.back"
      | "page.forward"
      | "page.click"
      | "page.type"
      | "page.press"
      | "page.scroll"
      | "page.wait",
    options: BrowserActionOptions,
  ): Promise<BrowserActionResult> => {
    const auditRepository = await this.createAuditRepository();
    const client = await this.createClient();
    await auditRepository.appendEvent({
      command,
      reason: options.reason,
      leaseId: options.leaseId,
      at: new Date().toISOString(),
    });

    return client.request(command, options);
  };

  private createClient = async (): Promise<BrowserConnectorClient> => {
    const config = await this.configRepository.readConfig();
    return new BrowserConnectorClient(config.ipcPath);
  };

  private createAuditRepository = async (): Promise<AuditRepository> => {
    const config = await this.configRepository.readConfig();
    return new AuditRepository(config.homeDir);
  };
}
