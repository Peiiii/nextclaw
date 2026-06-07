import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { BrowserConnectorManager } from "@/managers/browser-connector.manager.js";
import type { BrowserSecurityPolicyService } from "@/services/browser-security-policy.service.js";
import { BrowserConnectorError } from "@/types/cli-output.types.js";
import type { BrowserConnectorCommandOutput } from "@/types/cli-output.types.js";

export type PageActionOptions = {
  lease?: string;
  selector?: string;
  ref?: string;
  interactive?: boolean;
  url?: string;
  text?: string;
  keys?: string;
  x?: number;
  y?: number;
  reason?: string;
  confirmed?: boolean;
  timeoutMs?: number;
  output?: string;
  includeDataUrl?: boolean;
};

export class PageController {
  constructor(
    private readonly browserConnectorManager: BrowserConnectorManager,
    private readonly browserSecurityPolicyService: BrowserSecurityPolicyService,
  ) {}

  snapshot = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> => ({
    ok: true,
    snapshot: await this.browserConnectorManager.snapshotPage(
      required(options.lease, "--lease"),
      { interactive: options.interactive ?? false },
    ),
  });

  locate = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> => ({
    ok: true,
    locate: await this.browserConnectorManager.locatePage(
      required(options.lease, "--lease"),
      required(options.text, "--text"),
    ),
  });

  screenshot = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> => {
    const { lease, output, includeDataUrl } = options;
    const leaseId = required(lease, "--lease");
    const screenshot = await this.browserConnectorManager.screenshotPage(leaseId, {
      includeDataUrl: true,
    });

    if (!output) {
      return {
        ok: true,
        screenshot,
      };
    }

    if (!screenshot.dataUrl) {
      throw new BrowserConnectorError(
        "IPC_REQUEST_FAILED",
        "page screenshot did not return PNG data.",
        { recoverable: true },
      );
    }

    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, dataUrlToBuffer(screenshot.dataUrl));

    return {
      ok: true,
      screenshot: {
        ...screenshot,
        dataUrl: includeDataUrl ? screenshot.dataUrl : undefined,
        outputPath: output,
      },
    };
  };

  goto = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> =>
    this.runAction("page.goto", options);

  reload = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> =>
    this.runAction("page.reload", options);

  back = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> =>
    this.runAction("page.back", options);

  forward = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> =>
    this.runAction("page.forward", options);

  click = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> => {
    this.assertClickTarget(options);
    return this.runAction("page.click", options);
  };

  type = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> =>
    this.runAction("page.type", options);

  press = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> =>
    this.runAction("page.press", options);

  scroll = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> =>
    this.runAction("page.scroll", options);

  wait = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> =>
    this.runAction("page.wait", options);

  private runAction = async (
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
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> => {
    const { lease, reason, confirmed, selector, ref, url, text, keys, x, y, timeoutMs } =
      options;
    const leaseId = required(lease, "--lease");
    const actionReason = required(reason, "--reason");
    const targetUrl = command === "page.goto"
      ? normalizeOpenableUrl(url)
      : undefined;
    this.browserSecurityPolicyService.assertWriteAllowed({
      command,
      reason: actionReason,
      confirmed,
    });

    return {
      ok: true,
      action: await this.browserConnectorManager.runPageAction(command, {
        leaseId,
        reason: actionReason,
        selector,
        ref,
        url: targetUrl,
        text,
        keys,
        x,
        y,
        timeoutMs,
      }),
    };
  };

  private assertClickTarget = (options: PageActionOptions): void => {
    const { selector, ref } = options;

    if (selector && ref) {
      throw new BrowserConnectorError(
        "INVALID_ARGUMENT",
        "page click accepts either --selector or --ref, not both.",
        { recoverable: false },
      );
    }

    if (!selector && !ref) {
      throw new BrowserConnectorError(
        "INVALID_ARGUMENT",
        "page click requires --selector or --ref.",
        { recoverable: false },
      );
    }
  };
}

const required = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new BrowserConnectorError(
      "INVALID_ARGUMENT",
      `${name} is required.`,
    );
  }

  return value;
};

const normalizeOpenableUrl = (url: string | undefined): string => {
  const value = required(url, "--url");

  try {
    const parsed = new URL(value);

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Unsupported protocol");
    }

    return parsed.toString();
  } catch {
    throw new BrowserConnectorError(
      "INVALID_ARGUMENT",
      "page goto requires an http or https URL.",
    );
  }
};

const dataUrlToBuffer = (dataUrl: string): Buffer => {
  const [, encoded] = dataUrl.split(",", 2);

  if (!encoded) {
    throw new BrowserConnectorError(
      "IPC_REQUEST_FAILED",
      "page screenshot returned an invalid data URL.",
      { recoverable: true },
    );
  }

  return Buffer.from(encoded, "base64");
};
