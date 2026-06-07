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
  frameSelector?: string;
  mode?: string;
  interactive?: boolean;
  url?: string;
  text?: string;
  state?: string;
  value?: string;
  label?: string;
  index?: number;
  level?: string;
  limit?: number;
  keys?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fullPage?: boolean;
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

  inspect = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> => {
    const { frameSelector, lease, ref, selector } = options;
    this.assertElementTarget("page inspect", options);

    return {
      ok: true,
      inspect: await this.browserConnectorManager.inspectPage(
        required(lease, "--lease"),
        {
          selector,
          ref,
          frameSelector,
        },
      ),
    };
  };

  screenshot = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> => {
    const { lease, output, includeDataUrl, fullPage, x, y, width, height } = options;
    const leaseId = required(lease, "--lease");
    const screenshot = await this.browserConnectorManager.screenshotPage(leaseId, {
      includeDataUrl: true,
      fullPage: fullPage ?? false,
      clip: buildClip({ x, y, width, height }),
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
    this.assertElementTarget("page click", options);
    return this.runAction("page.click", options);
  };

  fill = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> => {
    this.assertElementTarget("page fill", options);
    required(options.text, "--text");
    this.assertTextEntryMode(options.mode);
    return this.runAction("page.fill", options);
  };

  type = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> => {
    this.assertElementTarget("page type", options);
    required(options.text, "--text");
    this.assertTextEntryMode(options.mode);
    return this.runAction("page.type", options);
  };

  check = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> => {
    this.assertElementTarget("page check", options);
    return this.runAction("page.check", options);
  };

  uncheck = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> => {
    this.assertElementTarget("page uncheck", options);
    return this.runAction("page.uncheck", options);
  };

  select = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> => {
    this.assertElementTarget("page select", options);
    if (!options.value && !options.label && options.index === undefined) {
      throw new BrowserConnectorError(
        "INVALID_ARGUMENT",
        "page select requires --value, --label, or --index.",
      );
    }
    return this.runAction("page.select", options);
  };

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

  waitUrl = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> => {
    required(options.url, "--url");
    return this.runAction("page.wait-url", options);
  };

  waitLoad = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> =>
    this.runAction("page.wait-load", options);

  waitElement = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> =>
    this.runAction("page.wait-element", options);

  logs = async (
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> => ({
    ok: true,
    action: await this.browserConnectorManager.runPageAction("page.logs", {
      leaseId: required(options.lease, "--lease"),
      reason: "read current page logs",
      level: options.level,
      limit: options.limit,
    }),
  });

  private runAction = async (
    command:
      | "page.goto"
      | "page.reload"
      | "page.back"
      | "page.forward"
      | "page.click"
      | "page.fill"
      | "page.type"
      | "page.check"
      | "page.uncheck"
      | "page.select"
      | "page.press"
      | "page.scroll"
      | "page.wait"
      | "page.wait-url"
      | "page.wait-load"
      | "page.wait-element",
    options: PageActionOptions,
  ): Promise<BrowserConnectorCommandOutput> => {
    const { lease, reason, confirmed, selector, ref, frameSelector, mode, url, text, keys, x, y, timeoutMs, state, value, label, index } =
      options;
    const leaseId = required(lease, "--lease");
    const actionReason = required(reason, "--reason");
    const actionUrl = command === "page.goto"
      ? normalizeOpenableUrl(url)
      : url;
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
        frameSelector,
        mode,
        url: actionUrl,
        text,
        keys,
        x,
        y,
        timeoutMs,
        state,
        value,
        label,
        index,
      }),
    };
  };

  private assertElementTarget = (command: string, options: PageActionOptions): void => {
    const { selector, ref } = options;

    if (selector && ref) {
      throw new BrowserConnectorError(
        "INVALID_ARGUMENT",
        `${command} accepts either --selector or --ref, not both.`,
        { recoverable: false },
      );
    }

    if (!selector && !ref) {
      throw new BrowserConnectorError(
        "INVALID_ARGUMENT",
        `${command} requires --selector or --ref.`,
        { recoverable: false },
      );
    }
  };

  private assertTextEntryMode = (mode: string | undefined): void => {
    if (mode === undefined || mode === "direct" || mode === "paste") {
      return;
    }

    throw new BrowserConnectorError(
      "INVALID_ARGUMENT",
      "page fill/type --mode must be direct or paste.",
      { recoverable: false },
    );
  };
}

const buildClip = (
  options: Pick<PageActionOptions, "x" | "y" | "width" | "height">,
): { x: number; y: number; width: number; height: number } | undefined => {
  const { x, y, width, height } = options;
  const hasAny = x !== undefined || y !== undefined || width !== undefined || height !== undefined;

  if (!hasAny) {
    return undefined;
  }

  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    throw new BrowserConnectorError(
      "INVALID_ARGUMENT",
      "page screenshot clip requires --x, --y, --width, and --height together.",
    );
  }

  return { x, y, width, height };
};

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
