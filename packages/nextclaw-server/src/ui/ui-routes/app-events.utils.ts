import { eventKeys } from "@nextclaw/shared";
import type { UiRouterOptions } from "./types.js";

function appEventOptions() {
  return {
    emittedAt: new Date().toISOString(),
    source: "backend",
  };
}

export function emitConfigUpdated(options: UiRouterOptions, path: string): void {
  options.appEventBus.emit(eventKeys.configUpdated, { path }, appEventOptions());
}

export function emitChannelConfigApplyStatus(
  options: UiRouterOptions,
  payload: {
    channel: string;
    status: "started" | "succeeded" | "failed";
    message?: string;
  },
): void {
  options.appEventBus.emit(eventKeys.channelConfigApplyStatus, payload, appEventOptions());
}

export function emitUiError(
  options: UiRouterOptions,
  payload: {
    code?: string;
    message: string;
  },
): void {
  options.appEventBus.emit(eventKeys.error, payload, appEventOptions());
}
