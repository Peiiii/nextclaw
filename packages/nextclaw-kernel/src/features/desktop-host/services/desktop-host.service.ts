import type {
  DesktopCapabilityError,
  DesktopHostCaller,
  DesktopHostEvent,
  DesktopHostMethod,
  DesktopHostStatus,
} from "@kernel/features/desktop-host/types/desktop-host.types.js";

export type DesktopHostEventListener = (event: DesktopHostEvent) => void;

/**
 * The Kernel-facing boundary for the local desktop host.  A runtime host owns
 * its platform implementation; the Kernel owns grants and caller identity.
 */
export type DesktopHost = {
  status: () => Promise<DesktopHostStatus>;
  invoke: <T>(
    method: DesktopHostMethod,
    payload: Record<string, unknown>,
    caller: DesktopHostCaller,
  ) => Promise<T>;
  onEvent: (listener: DesktopHostEventListener) => () => void;
  dispose: () => Promise<void>;
};

export function createDesktopHostError(error: DesktopCapabilityError): Error {
  const result = new Error(error.message);
  Object.assign(result, error);
  return result;
}

/** Used by short-lived Kernel entry points which do not own a local host. */
export class UnavailableDesktopHost implements DesktopHost {
  status = async (): Promise<DesktopHostStatus> => ({
    online: false,
    supportedAccess: [],
    supportedOperations: [],
    permissions: {
      accessibility: "not_supported",
      screenCapture: "not_supported",
    },
  });

  invoke = async <T>(): Promise<T> => {
    throw createDesktopHostError({
      code: "desktop_host_unavailable",
      message: "Desktop automation is unavailable in this NextClaw runtime.",
      recovery: { action: "start_desktop" },
    });
  };

  onEvent = (): (() => void) => () => undefined;

  dispose = async (): Promise<void> => undefined;
}
