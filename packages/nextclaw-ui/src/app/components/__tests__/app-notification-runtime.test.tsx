import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppNotificationRuntime } from "@/app/components/app-notification-runtime";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("@/app/components/app-presenter-provider", () => ({
  useAppPresenter: () => ({
    chatCompletionNotificationManager: {
      start: mocks.start,
      stop: mocks.stop,
    },
  }),
}));

describe("AppNotificationRuntime", () => {
  beforeEach(() => {
    mocks.start.mockReset();
    mocks.stop.mockReset();
  });

  it("starts and stops the global completion notification lifecycle", () => {
    const view = render(<AppNotificationRuntime />);
    expect(mocks.start).toHaveBeenCalledOnce();

    view.unmount();
    expect(mocks.stop).toHaveBeenCalledOnce();
  });
});
