import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppNotificationManager,
  AppNotificationToast,
  type AppNotificationToastProps,
} from "@/features/notifications";
import { t } from "@/shared/lib/i18n";

const mocks = vi.hoisted(() => ({
  custom: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    custom: mocks.custom,
    dismiss: mocks.dismiss,
  },
}));

describe("AppNotificationManager", () => {
  beforeEach(() => {
    mocks.custom.mockReset();
    mocks.dismiss.mockReset();
    mocks.custom.mockReturnValue("toast-result");
  });

  it("uses the shared custom notification surface and stable lifecycle defaults", () => {
    const manager = new AppNotificationManager();
    const result = manager.show({
      id: "reply:message-1",
      title: "Research complete",
      description: "The findings are ready.",
      href: "/chat/session-1",
    });

    expect(result).toBe("toast-result");
    expect(mocks.custom).toHaveBeenCalledWith(expect.any(Function), {
      id: "reply:message-1",
      duration: 8_000,
      unstyled: true,
    });

    const renderer = mocks.custom.mock.calls[0]?.[0] as (
      id: string | number,
    ) => unknown;
    const element = renderer("toast-rendered");
    expect(isValidElement<AppNotificationToastProps>(element)).toBe(true);
    if (!isValidElement<AppNotificationToastProps>(element)) {
      throw new Error("Expected AppNotificationToast element");
    }
    expect(element.type).toBe(AppNotificationToast);
    expect(element.props).toEqual(expect.objectContaining({
      title: "Research complete",
      description: "The findings are ready.",
      href: "/chat/session-1",
      dismissLabel: t("notificationDismiss"),
    }));

    element.props.onDismiss();
    expect(mocks.dismiss).toHaveBeenCalledWith("toast-rendered");
  });

  it("supports a caller-owned duration and explicit dismiss", () => {
    const manager = new AppNotificationManager();
    manager.show({ title: "Saved", durationMs: 2_500 });
    manager.dismiss("saved-toast");

    expect(mocks.custom).toHaveBeenCalledWith(expect.any(Function), {
      id: undefined,
      duration: 2_500,
      unstyled: true,
    });
    expect(mocks.dismiss).toHaveBeenCalledWith("saved-toast");
  });
});
