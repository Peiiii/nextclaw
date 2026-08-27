import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

export type MacosAccessibilityNode = {
  role?: string;
  subrole?: string;
  title?: string;
  value?: string;
  description?: string;
  identifier?: string;
  enabled?: boolean;
  focused?: boolean;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  children?: MacosAccessibilityNode[];
};

type NativeMacosAccessibilityAdapter = {
  isTrusted: (prompt: boolean) => boolean;
  isScreenCaptureTrusted?: () => boolean;
  requestScreenCapturePermission?: () => boolean;
  recognizeText?: (imageData: string, options?: { detail?: "low" | "high" }) => string;
  resolveApplication: (bundleId: string) => { bundleId: string; pid: number; name: string } | null;
  snapshot: (bundleId: string, options?: { maxDepth?: number; maxNodes?: number; pid?: number }) => MacosAccessibilityNode;
  observe: (bundleId: string, callback: (event: { notification?: string }) => void) => string;
  unobserve: (watchId: string) => boolean;
  performAction: (bundleId: string, input: {
    path: number[];
    type: "setValue" | "press" | "confirm";
    value?: string;
    pid?: number;
    windowId?: number;
  }) => { succeeded: boolean; verified?: boolean; observedValue?: string };
  clickAt?: (bundleId: string, input: { x: number; y: number; pid?: number; windowId?: number }) => { succeeded: boolean };
  typeText?: (bundleId: string, input: { text: string; pid?: number; windowId?: number }) => { succeeded: boolean };
  pressKey?: (bundleId: string, input: { key: string; modifiers?: string[]; pid?: number; windowId?: number }) => { succeeded: boolean };
  resolveWindow?: (bundleId: string, options?: { pid?: number }) => {
    pid: number;
    windowId: number;
    window: { title?: string; position?: { x: number; y: number }; size?: { width: number; height?: number } };
  };
  resolveCaptureWindow?: (bundleId: string, options?: { pid?: number }) => Promise<{
    pid: number;
    windowId: number;
    window: { title?: string; position?: { x: number; y: number }; size?: { width: number; height?: number } };
  }>;
  captureWindow?: (windowId: number, options?: { detail?: "low" | "high" }) => Promise<{ mimeType: "image/png"; data: string; width?: number; height?: number }>;
  captureApplicationWindow?: (bundleId: string, options?: { pid?: number; detail?: "low" | "high" }) => Promise<{
    pid: number;
    windowId: number;
    window: { title?: string; position?: { x: number; y: number }; size?: { width: number; height?: number } };
    mimeType: "image/png";
    data: string;
    width?: number;
    height?: number;
  }>;
};

type Permission = "granted" | "not_granted" | "not_supported";

export class MacosAccessibilityService {
  // The adapter is loaded by the isolated Host Worker. Recreating that worker
  // is therefore sufficient to pick up the foreground capture native artifact.
  private adapter: NativeMacosAccessibilityAdapter | null | undefined;

  constructor(private readonly options: {
    adapter?: NativeMacosAccessibilityAdapter;
    nativeModulePath?: string;
    keyboardInputHelperPath?: string;
  } = {}) {}

  get supported(): boolean {
    return process.platform === "darwin" && this.loadAdapter() !== null;
  }

  getPermission = (): Permission => this.withAdapter((adapter) =>
    adapter.isTrusted(false) ? "granted" : "not_granted",
  );

  requestPermission = (): Permission => this.withAdapter((adapter) =>
    adapter.isTrusted(true) ? "granted" : "not_granted",
  );

  getScreenCapturePermission = (): Permission => this.withAdapter((adapter) =>
    adapter.isScreenCaptureTrusted?.() ? "granted" : "not_supported",
  );

  requestScreenCapturePermission = (): Permission => this.withAdapter((adapter) =>
    adapter.requestScreenCapturePermission?.() ? "granted" : "not_supported",
  );

  resolveApplication = (bundleId: string): { bundleId: string; pid: number; name: string } => {
    const application = this.requireAdapter().resolveApplication(bundleId);
    if (!application) throw createMacosAccessibilityError("target_not_running", `${bundleId} is not running.`);
    return application;
  };

  snapshot = (bundleId: string, options: { maxDepth?: number; maxNodes?: number; pid?: number } = {}): MacosAccessibilityNode => {
    this.requirePermission();
    return this.requireAdapter().snapshot(bundleId, {
      maxDepth: clampInteger(options.maxDepth, 1, 32, 12),
      // AX calls are synchronous CoreFoundation calls. Keep the default small
      // enough that a complex app cannot stall the long-running service.
      maxNodes: clampInteger(options.maxNodes, 1, 2_000, 500),
      ...(options.pid === undefined ? {} : { pid: options.pid }),
    });
  };

  observe = (bundleId: string, onEvent: (event: { notification?: string }) => void): { stop: () => boolean } => {
    this.requirePermission();
    const adapter = this.requireAdapter();
    const watchId = adapter.observe(bundleId, onEvent);
    let stopped = false;
    return { stop: () => {
      if (stopped) return false;
      stopped = true;
      return adapter.unobserve(watchId);
    } };
  };

  performAction = (bundleId: string, input: {
    path: number[];
    type: "setValue" | "press" | "confirm";
    value?: string;
    pid?: number;
    windowId?: number;
  }): { succeeded: boolean; verified?: boolean; observedValue?: string } => {
    this.requirePermission();
    if (!Array.isArray(input.path) || !input.path.every((index) => Number.isInteger(index) && index >= 0)) {
      throw createMacosAccessibilityError("host_operation_failed", "Accessibility element path is invalid.");
    }
    return this.requireAdapter().performAction(bundleId, input);
  };

  clickAt = (bundleId: string, input: { x: number; y: number; pid?: number; windowId?: number }): { succeeded: boolean } => {
    this.requirePermission();
    if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) {
      throw createMacosAccessibilityError("host_operation_failed", "Pointer coordinates are invalid.");
    }
    const clickAt = this.requireAdapter().clickAt;
    if (!clickAt) throw createMacosAccessibilityError("operation_not_supported", "macOS pointer input is unavailable.");
    return clickAt(bundleId, input);
  };

  typeText = (bundleId: string, input: { text: string; pid?: number; windowId?: number }): { succeeded: boolean } => {
    this.requirePermission();
    if (!input.text) {
      throw createMacosAccessibilityError("operation_not_supported", "Typing requires non-empty text.");
    }
    const typeText = this.requireAdapter().typeText;
    if (!typeText) throw createMacosAccessibilityError("operation_not_supported", "macOS keyboard input is unavailable.");
    return typeText(bundleId, input);
  };

  pressKey = (bundleId: string, input: { key: string; modifiers?: string[]; pid?: number; windowId?: number }): { succeeded: boolean } => {
    this.requirePermission();
    const key = input.key.trim();
    if (!isSupportedKey(key) || !isSupportedModifiers(input.modifiers)) {
      throw createMacosAccessibilityError("operation_not_supported", "Keyboard key or modifiers are not supported.");
    }
    // Unit tests inject an adapter. Production input runs outside the AX worker:
    // Quartz physical-key events can abort a non-GUI worker process on macOS.
    if (this.options.adapter?.pressKey) return this.options.adapter.pressKey(bundleId, { ...input, key });
    const helper = this.resolveKeyboardInputHelper();
    if (!helper || input.pid === undefined) {
      throw createMacosAccessibilityError("operation_not_supported", "macOS key input helper is unavailable.");
    }
    try {
      execFileSync(helper, [bundleId, String(input.pid), key, input.modifiers?.join(",") ?? ""], {
        stdio: "ignore",
        timeout: 5_000,
      });
      return { succeeded: true };
    } catch {
      throw createMacosAccessibilityError("host_operation_failed", "macOS key input helper did not complete.");
    }
  };

  resolveWindow = (bundleId: string, options: { pid?: number } = {}): {
    pid: number;
    windowId: number;
    window: { title?: string; position?: { x: number; y: number }; size?: { width: number; height?: number } };
  } => {
    const resolveWindow = this.requireAdapter().resolveWindow;
    if (!resolveWindow) throw createMacosAccessibilityError("operation_not_supported", "macOS window capture is unavailable.");
    return resolveWindow(bundleId, options);
  };

  resolveCaptureWindow = async (bundleId: string, options: { pid?: number } = {}): Promise<{
    pid: number;
    windowId: number;
    window: { title?: string; position?: { x: number; y: number }; size?: { width: number; height?: number } };
  }> => {
    this.requireScreenCapturePermission();
    const resolveCaptureWindow = this.requireAdapter().resolveCaptureWindow;
    if (!resolveCaptureWindow) throw createMacosAccessibilityError("operation_not_supported", "macOS window capture is unavailable.");
    return await resolveCaptureWindow(bundleId, options);
  };

  captureWindow = async (
    windowId: number,
    options: { detail?: "low" | "high" } = {},
  ): Promise<{ mimeType: "image/png"; data: string; width?: number; height?: number }> => {
    if (!Number.isInteger(windowId) || windowId <= 0) {
      throw createMacosAccessibilityError("host_operation_failed", "Window identifier is invalid.");
    }
    this.requireScreenCapturePermission();
    const captureWindow = this.requireAdapter().captureWindow;
    if (!captureWindow) throw createMacosAccessibilityError("operation_not_supported", "Native macOS window capture is unavailable.");
    return await captureWindow(windowId, options);
  };

  captureApplicationWindow = async (
    bundleId: string,
    options: { pid?: number; detail?: "low" | "high" } = {},
  ): Promise<{
    pid: number;
    windowId: number;
    window: { title?: string; position?: { x: number; y: number }; size?: { width: number; height?: number } };
    mimeType: "image/png";
    data: string;
    width?: number;
    height?: number;
  }> => {
    this.requireScreenCapturePermission();
    const captureApplicationWindow = this.requireAdapter().captureApplicationWindow;
    if (!captureApplicationWindow) throw createMacosAccessibilityError("operation_not_supported", "Native macOS window capture is unavailable.");
    return await captureApplicationWindow(bundleId, options);
  };

  recognizeText = (imageData: string, options: { detail?: "low" | "high" } = {}): string => {
    this.requireScreenCapturePermission();
    const recognizeText = this.requireAdapter().recognizeText;
    if (!recognizeText) throw createMacosAccessibilityError("operation_not_supported", "On-device text recognition is unavailable.");
    return recognizeText(imageData, options);
  };

  private withAdapter = (getPermission: (adapter: NativeMacosAccessibilityAdapter) => Permission): Permission => {
    const adapter = this.loadAdapter();
    return adapter ? getPermission(adapter) : "not_supported";
  };

  private requirePermission = (): void => {
    if (this.getPermission() !== "granted") {
      throw createMacosAccessibilityError("permission_not_granted", "NextClaw needs macOS Accessibility permission.", "open_settings");
    }
  };

  private requireScreenCapturePermission = (): void => {
    if (this.getScreenCapturePermission() !== "granted") {
      throw createMacosAccessibilityError("permission_not_granted", "NextClaw needs macOS Screen Recording permission.", "open_settings");
    }
  };

  private requireAdapter = (): NativeMacosAccessibilityAdapter => {
    const adapter = this.loadAdapter();
    if (!adapter) throw createMacosAccessibilityError("unsupported_platform", "macOS Accessibility is unavailable.");
    return adapter;
  };

  private loadAdapter = (): NativeMacosAccessibilityAdapter | null => {
    if (this.adapter !== undefined) return this.adapter;
    if (this.options.adapter) return this.adapter = this.options.adapter;
    if (process.platform !== "darwin") return this.adapter = null;
    const candidates = [
      this.options.nativeModulePath,
      process.env.NEXTCLAW_MACOS_ACCESSIBILITY_MODULE,
      join(moduleDirectory, "..", "..", "native", "macos-accessibility.node"),
      join(moduleDirectory, "..", "..", "..", "build", "native", "macos-accessibility.node"),
      join((process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ?? "", "native", "macos-accessibility.node"),
      join(moduleDirectory, "..", "..", "..", "..", "..", "apps", "desktop", "build", "native-app-resources", "native", "macos-accessibility.node"),
    ].filter((value): value is string => Boolean(value?.trim()));
    const require = createRequire(import.meta.url);
    for (const candidate of candidates) {
      if (!existsSync(candidate)) continue;
      try {
        return this.adapter = require(candidate) as NativeMacosAccessibilityAdapter;
      } catch {
        // The next governed artifact location may match this runtime's ABI.
      }
    }
    return this.adapter = null;
  };

  private resolveKeyboardInputHelper = (): string | null => {
    const candidates = [
      this.options.keyboardInputHelperPath,
      process.env.NEXTCLAW_MACOS_KEYBOARD_INPUT_HELPER,
      join(moduleDirectory, "..", "..", "..", "build", "native", "macos-keyboard-input"),
      join((process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ?? "", "native", "macos-keyboard-input"),
      join(moduleDirectory, "..", "..", "..", "..", "..", "apps", "desktop", "build", "native-app-resources", "native", "macos-keyboard-input"),
    ].filter((value): value is string => Boolean(value?.trim()));
    return candidates.find((candidate) => existsSync(candidate)) ?? null;
  };
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value!)) : fallback;
}

const SUPPORTED_KEYS = new Set([
  ..."abcdefghijklmnopqrstuvwxyz0123456789",
  "Enter", "Escape", "Tab", "Space", "Backspace", "Delete",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
]);
const SUPPORTED_KEY_MODIFIERS = new Set(["command", "control", "option", "shift"]);

function isSupportedKey(key: string): boolean {
  return SUPPORTED_KEYS.has(key);
}

function isSupportedModifiers(modifiers: string[] | undefined): boolean {
  return modifiers === undefined || (
    Array.isArray(modifiers) &&
    modifiers.every((modifier) => SUPPORTED_KEY_MODIFIERS.has(modifier)) &&
    new Set(modifiers).size === modifiers.length
  );
}

function createMacosAccessibilityError(
  code: string,
  message: string,
  action?: "open_settings",
): Error {
  const error = new Error(message);
  Object.assign(error, { code, ...(action ? { recovery: { action } } : {}) });
  return error;
}
