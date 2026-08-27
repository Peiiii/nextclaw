import { createHash, randomUUID } from "node:crypto";
import type { DesktopHostCapabilityManager } from "@kernel/features/desktop-host/managers/desktop-host-capability.manager.js";

const MAX_STATES_PER_SESSION = 12;
const MAX_SESSIONS = 64;
const STATE_TTL_MS = 5 * 60_000;
// A synthesized keyboard event reaches some native applications asynchronously.
// Keep the SDK call ordered with the following state read, so an Agent does not
// observe a pre-input frame and incorrectly conclude that a safe draft failed.
const INPUT_SETTLE_MS = 350;

export type DesktopSessionCaller = {
  agentId: string;
  sessionId: string;
  agentRunId?: string;
};

export type DesktopSnapshotOptions = {
  target: { applicationId: string };
  source?: "accessibility" | "screen" | "both";
  detail?: "low" | "high";
  maxDepth?: number;
  maxNodes?: number;
};

type DesktopState = {
  stateId: string;
  target: { applicationId: string };
  targetLocator?: { bundleId: string; pid: number; windowId: number };
  snapshotOptions?: Pick<DesktopSnapshotOptions, "maxDepth" | "maxNodes">;
  screenDetail?: "low" | "high";
  screenHash?: string;
  screenWindow?: { position: { x: number; y: number }; size: { width: number; height: number } };
  screenImageSize?: { width: number; height: number };
  elements: Map<number, { path: number[]; role: string }>;
  expiresAt: number;
};

/** Owns short-lived AX element references for one Agent session. */
export class DesktopSessionStateService {
  private readonly statesBySession = new Map<string, Map<string, DesktopState>>();

  constructor(private readonly manager: DesktopHostCapabilityManager) {}

  snapshot = async (
    caller: DesktopSessionCaller,
    options: DesktopSnapshotOptions,
  ): Promise<unknown> => {
    const { target, source: requestedSource, detail, maxDepth, maxNodes } = options;
    const source = requestedSource ?? "accessibility";
    const snapshotOptions = {
      ...(maxDepth === undefined ? {} : { maxDepth }),
      ...(maxNodes === undefined ? {} : { maxNodes }),
    };
    const screen = source === "accessibility"
      ? undefined
      : await this.manager.invokeAgent<unknown>({
          ...caller,
          method: "host.screen.captureWindow",
          payload: {
            target,
            ...(detail === undefined ? {} : { detail }),
          },
        });
    const screenLocator = readTargetLocator(screen);
    const snapshot = source === "screen"
      ? undefined
      : await this.manager.invokeAgent<unknown>({
          ...caller,
          method: "host.ui.snapshot",
          payload: {
            target,
            ...(screenLocator ? { locator: screenLocator } : {}),
            ...snapshotOptions,
          },
        });
    const targetLocator = screenLocator ?? readTargetLocator(snapshot);
    const stateId = randomUUID();
    const elements = snapshot === undefined ? new Map() : collectElements(snapshot);
    const state: DesktopState = {
      stateId,
      target,
      ...(targetLocator ? { targetLocator } : {}),
      ...(snapshot === undefined ? {} : { snapshotOptions }),
      ...(screen === undefined || detail === undefined ? {} : { screenDetail: detail }),
      ...(screen === undefined ? {} : { screenHash: hashScreenSnapshot(screen) }),
      ...(readScreenWindow(screen) ? { screenWindow: readScreenWindow(screen)! } : {}),
      ...(readScreenImageSize(screen) ? { screenImageSize: readScreenImageSize(screen)! } : {}),
      elements,
      expiresAt: Date.now() + STATE_TTL_MS,
    };
    this.remember(caller, state);
    return {
      stateId,
      capturedAt: new Date().toISOString(),
      target,
      accessibility: {
        revision: stateId,
        isDiff: false,
        coverage: "bounded",
        text: snapshot === undefined ? "" : formatAccessibility(snapshot, elements),
      },
      ...(screen === undefined ? {} : { screenshot: screen }),
    };
  };

  setValue = async (
    caller: DesktopSessionCaller,
    input: { target: { applicationId: string }; stateId: string; elementIndex: number; value: string },
  ): Promise<unknown> =>
    await this.perform(caller, "set_value", input);

  click = async (
    caller: DesktopSessionCaller,
    input: { target: { applicationId: string }; stateId: string; elementIndex?: number; coordinate?: { x: number; y: number } },
  ): Promise<unknown> =>
    await this.perform(caller, "click", input);

  typeText = async (
    caller: DesktopSessionCaller,
    input: { target: { applicationId: string }; stateId: string; text: string },
  ): Promise<unknown> => {
    const states = this.sessionStates(caller);
    const state = states.get(input.stateId);
    if (!state || state.expiresAt < Date.now() || state.target.applicationId !== input.target.applicationId) {
      states.delete(input.stateId);
      throw desktopError("stale_state", "The Desktop screen state expired or belongs to a different target. Refresh state first.");
    }
    if (!state.screenHash || !input.text) {
      throw desktopError("operation_not_supported", "desktop.typeText requires a fresh screen state and non-empty text.");
    }
    const freshScreen = await this.manager.invokeAgent<unknown>({
      ...caller,
      source: "desktop",
      method: "host.screen.captureWindow",
      payload: {
        target: input.target,
        ...(state.targetLocator ? { locator: state.targetLocator } : {}),
        ...(state.screenDetail ? { detail: state.screenDetail } : {}),
      },
    });
    if (hashScreenSnapshot(freshScreen) !== state.screenHash) {
      states.delete(input.stateId);
      throw desktopError("stale_state", "The Desktop window changed after the screen state was captured. Refresh state before typing.");
    }
    const result = await this.manager.invokeAgent<unknown>({
      ...caller,
      source: "desktop",
      method: "host.input.typeText",
      payload: {
        target: input.target,
        ...(state.targetLocator ? { locator: state.targetLocator } : {}),
        text: input.text,
      },
    });
    await waitForInputSettle();
    states.delete(input.stateId);
    return { operationId: randomUUID(), operation: "type_text", result, stateInvalidated: true };
  };

  pressKey = async (
    caller: DesktopSessionCaller,
    input: { target: { applicationId: string }; stateId: string; key: string; modifiers?: string[] },
  ): Promise<unknown> => {
    const states = this.sessionStates(caller);
    const state = states.get(input.stateId);
    if (!state || state.expiresAt < Date.now() || state.target.applicationId !== input.target.applicationId) {
      states.delete(input.stateId);
      throw desktopError("stale_state", "The Desktop screen state expired or belongs to a different target. Refresh state first.");
    }
    if (!state.screenHash) {
      throw desktopError("operation_not_supported", "desktop.pressKey requires a fresh screen state.");
    }
    const freshScreen = await this.manager.invokeAgent<unknown>({
      ...caller,
      source: "desktop",
      method: "host.screen.captureWindow",
      payload: {
        target: input.target,
        ...(state.targetLocator ? { locator: state.targetLocator } : {}),
        ...(state.screenDetail ? { detail: state.screenDetail } : {}),
      },
    });
    if (hashScreenSnapshot(freshScreen) !== state.screenHash) {
      states.delete(input.stateId);
      throw desktopError("stale_state", "The Desktop window changed after the screen state was captured. Refresh state before pressing a key.");
    }
    const result = await this.manager.invokeAgent<unknown>({
      ...caller,
      source: "desktop",
      method: "host.input.pressKey",
      payload: {
        target: input.target,
        ...(state.targetLocator ? { locator: state.targetLocator } : {}),
        key: input.key,
        ...(input.modifiers === undefined ? {} : { modifiers: input.modifiers }),
      },
    });
    await waitForInputSettle();
    states.delete(input.stateId);
    return { operationId: randomUUID(), operation: "press_key", result, stateInvalidated: true };
  };

  private perform = async (
    caller: DesktopSessionCaller,
    operation: "set_value" | "click",
    input: { target: { applicationId: string }; stateId: string; elementIndex?: number; coordinate?: { x: number; y: number }; value?: string },
  ): Promise<unknown> => {
    const states = this.sessionStates(caller);
    const state = states.get(input.stateId);
    if (!state || state.expiresAt < Date.now() || state.target.applicationId !== input.target.applicationId) {
      states.delete(input.stateId);
      throw desktopError("stale_state", "The Desktop element reference expired or belongs to a different target. Refresh state first.");
    }
    const coordinate = input.coordinate;
    const element = input.elementIndex === undefined ? undefined : state.elements.get(input.elementIndex);
    if (coordinate) {
      if (operation !== "click" || element) throw desktopError("invalid_tool_arguments", "A coordinate click cannot include an element index.");
      if (!state.screenHash || !state.screenWindow || !state.screenImageSize || !containsImage(state.screenImageSize, coordinate)) {
        throw desktopError("operation_not_supported", "Coordinate clicks require a fresh screen state and must stay inside the captured target window.");
      }
      const freshScreen = await this.manager.invokeAgent<unknown>({
        ...caller,
        source: "desktop",
        method: "host.screen.captureWindow",
        payload: {
          target: input.target,
          ...(state.targetLocator ? { locator: state.targetLocator } : {}),
          ...(state.screenDetail ? { detail: state.screenDetail } : {}),
        },
      });
      if (hashScreenSnapshot(freshScreen) !== state.screenHash) {
        states.delete(input.stateId);
        throw desktopError("stale_state", "The Desktop window changed after the screen state was captured. Refresh state before acting.");
      }
    } else {
      if (!element) throw desktopError("element_not_found", "The Desktop element index does not exist in this state.");
      const freshSnapshot = await this.manager.invokeAgent<unknown>({
        ...caller,
        source: "desktop",
        method: "host.ui.snapshot",
        payload: {
          target: input.target,
          ...(state.targetLocator ? { locator: state.targetLocator } : {}),
          ...state.snapshotOptions,
        },
      });
      if (!elementMatchesSnapshot(freshSnapshot, element)) {
        states.delete(input.stateId);
        throw desktopError("stale_state", "The Desktop element changed after the state was captured. Refresh state before acting.");
      }
    }
    const value = operation === "set_value" ? requiredValue(input.value, "value") : undefined;
    const result = coordinate
      ? await this.manager.invokeAgent<unknown>({
          ...caller,
          source: "desktop",
          method: "host.input.click",
          // Agent coordinates are pixels in the screenshot it just observed.
          // The native adapter expects global macOS coordinates, so translate
          // only after validating the point against that screenshot's bounds.
          payload: {
            target: input.target,
            ...(state.targetLocator ? { locator: state.targetLocator } : {}),
            coordinate: screenToWindowCoordinate(coordinate, state.screenWindow!, state.screenImageSize!),
            window: state.screenWindow,
          },
        })
      : await this.manager.invokeAgent<unknown>({
          ...caller,
          source: "desktop",
          method: "host.ui.action",
          payload: {
            target: input.target,
            ...(state.targetLocator ? { locator: state.targetLocator } : {}),
            action: {
              type: operation === "click" ? "press" : "setValue",
              path: element!.path,
              ...(value === undefined ? {} : { value }),
            },
          },
        });
    states.delete(input.stateId);
    return { operationId: randomUUID(), operation, result, stateInvalidated: true };
  };

  private remember(caller: DesktopSessionCaller, state: DesktopState): void {
    const states = this.sessionStates(caller);
    states.set(state.stateId, state);
    while (states.size > MAX_STATES_PER_SESSION) states.delete(states.keys().next().value as string);
    while (this.statesBySession.size > MAX_SESSIONS) this.statesBySession.delete(this.statesBySession.keys().next().value as string);
  }

  private sessionStates(caller: DesktopSessionCaller): Map<string, DesktopState> {
    const key = `${caller.agentId}:${caller.sessionId}`;
    const states = this.statesBySession.get(key) ?? new Map<string, DesktopState>();
    this.statesBySession.delete(key);
    this.statesBySession.set(key, states);
    return states;
  }
}

function collectElements(snapshot: unknown): Map<number, { path: number[]; role: string }> {
  const elements = new Map<number, { path: number[]; role: string }>();
  const walk = (node: unknown, path: number[]): void => {
    const record = asRecord(node);
    elements.set(elements.size, { path, role: typeof record.role === "string" ? record.role : "" });
    const children = Array.isArray(record.children) ? record.children : [];
    for (const [index, child] of children.entries()) walk(child, [...path, index]);
  };
  walk(snapshot, []);
  return elements;
}

function formatAccessibility(snapshot: unknown, elements: ReadonlyMap<number, { path: number[]; role: string }>): string {
  const lines: string[] = [];
  const walk = (node: unknown, depth: number): void => {
    const record = asRecord(node);
    const element = elements.get(lines.length);
    const fields = [
      record.role ? `role=${String(record.role)}` : "",
      record.title ? `title=${JSON.stringify(record.title)}` : "",
      record.value ? `value=${JSON.stringify(record.value)}` : "",
      record.description ? `description=${JSON.stringify(record.description)}` : "",
      record.enabled === false ? "disabled" : "",
      element ? `path=${element.path.join(".") || "root"}` : "",
    ].filter(Boolean);
    lines.push(`${"  ".repeat(depth)}[${lines.length}] ${fields.join(" ")}`);
    const children = Array.isArray(record.children) ? record.children : [];
    for (const child of children) walk(child, depth + 1);
  };
  walk(snapshot, 0);
  return lines.join("\n");
}

function hashScreenSnapshot(snapshot: unknown): string {
  const screen = asRecord(snapshot);
  const image = asRecord(screen.image);
  // OCR is derived content, not the coordinate-system contract. Dynamic clocks,
  // counters, and streamed chat text may change between two otherwise identical
  // frames; rejecting a click for that would turn normal desktop UI into a
  // permanent stale-state failure. The target window geometry and raster bounds
  // are the stable facts that keep coordinate input confined to the captured UI.
  return createHash("sha256").update(JSON.stringify({
    target: screen.target,
    window: screen.window,
    image: {
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
    },
  })).digest("hex");
}

function elementMatchesSnapshot(
  snapshot: unknown,
  element: { path: number[]; role: string },
): boolean {
  let node = asRecord(snapshot);
  for (const index of element.path) {
    const children = Array.isArray(node.children) ? node.children : [];
    node = asRecord(children[index]);
  }
  return (typeof node.role === "string" ? node.role : "") === element.role;
}

function readTargetLocator(value: unknown): DesktopState["targetLocator"] | undefined {
  const record = asRecord(value);
  const locator = asRecord(record.targetLocator ?? record.target);
  const bundleId = typeof locator.bundleId === "string" ? locator.bundleId : "";
  if (!bundleId || !isPositiveInteger(locator.pid) || !isPositiveInteger(locator.windowId)) return undefined;
  return { bundleId, pid: locator.pid, windowId: locator.windowId };
}

function readScreenWindow(value: unknown): DesktopState["screenWindow"] | undefined {
  const screen = asRecord(value);
  const window = asRecord(screen.window);
  const position = asRecord(window.position);
  const size = asRecord(window.size);
  if (
    !isFiniteNumber(position.x) || !isFiniteNumber(position.y) ||
    !isFiniteNumber(size.width) || !isFiniteNumber(size.height) ||
    size.width <= 0 || size.height <= 0
  ) return undefined;
  return {
    position: { x: position.x, y: position.y },
    size: { width: size.width, height: size.height },
  };
}

function readScreenImageSize(value: unknown): DesktopState["screenImageSize"] | undefined {
  const screen = asRecord(value);
  const image = asRecord(screen.image);
  const window = readScreenWindow(value);
  const width = isFiniteNumber(image.width) ? image.width : window?.size.width;
  const height = isFiniteNumber(image.height) ? image.height : window?.size.height;
  if (!isFiniteNumber(width) || !isFiniteNumber(height) || width <= 0 || height <= 0) return undefined;
  return { width, height };
}

function containsImage(
  image: NonNullable<DesktopState["screenImageSize"]>,
  coordinate: { x: number; y: number },
): boolean {
  return Number.isFinite(coordinate.x) && Number.isFinite(coordinate.y) &&
    coordinate.x >= 0 && coordinate.y >= 0 &&
    coordinate.x < image.width && coordinate.y < image.height;
}

function screenToWindowCoordinate(
  coordinate: { x: number; y: number },
  window: NonNullable<DesktopState["screenWindow"]>,
  image: NonNullable<DesktopState["screenImageSize"]>,
): { x: number; y: number } {
  return {
    x: window.position.x + coordinate.x * window.size.width / image.width,
    y: window.position.y + coordinate.y * window.size.height / image.height,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function requiredValue(value: unknown, field: string): string {
  if (typeof value !== "string") throw desktopError("invalid_tool_arguments", `${field} must be a string.`);
  return value;
}

function waitForInputSettle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, INPUT_SETTLE_MS));
}

function desktopError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}
