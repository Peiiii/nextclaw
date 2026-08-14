import { act, render, screen } from "@testing-library/react";
import {
  ToolExecutionDuration,
  formatCompletedToolDuration,
  formatRunningToolDuration,
  readCompletedToolDurationMs,
} from "./tool-execution-duration";

describe("tool execution duration", () => {
  it("formats completed and running durations at unit boundaries", () => {
    expect(formatCompletedToolDuration(0)).toBe("0ms");
    expect(formatCompletedToolDuration(999)).toBe("999ms");
    expect(formatCompletedToolDuration(1000)).toBe("1s");
    expect(formatCompletedToolDuration(59_999)).toBe("60s");
    expect(formatCompletedToolDuration(60_000)).toBe("1m 00s");
    expect(formatCompletedToolDuration(3_600_000)).toBe("1h 00m 00s");
    expect(formatRunningToolDuration(67_000)).toBe("1m 07s");
    expect(formatCompletedToolDuration(-1)).toBeNull();
    expect(formatCompletedToolDuration(Number.NaN)).toBeNull();
  });

  it("prefers producer duration and rejects reversed timestamps", () => {
    expect(
      readCompletedToolDurationMs({
        startedAt: "2026-08-14T00:00:00.000Z",
        endedAt: "2026-08-14T00:00:05.000Z",
        durationMs: 4270,
      }),
    ).toBe(4270);
    expect(
      readCompletedToolDurationMs({
        startedAt: "2026-08-14T00:00:05.000Z",
        endedAt: "2026-08-14T00:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("updates a running timer and freezes on the standard terminal duration", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T00:00:00.000Z"));
    const { container, rerender, unmount } = render(
      <ToolExecutionDuration
        execution={{ startedAt: "2026-08-14T00:00:00.000Z" }}
        statusTone="running"
      />,
    );
    expect(screen.getByText("0s")).toBeTruthy();
    expect(container.querySelector("[aria-live]")).toBeNull();

    act(() => vi.advanceTimersByTime(2200));
    expect(screen.getByText("2s")).toBeTruthy();

    rerender(
      <ToolExecutionDuration
        execution={{
          startedAt: "2026-08-14T00:00:00.000Z",
          endedAt: "2026-08-14T00:00:01.250Z",
          durationMs: 1250,
        }}
        statusTone="error"
      />,
    );
    expect(screen.getByText("1.25s")).toBeTruthy();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("1.25s")).toBeTruthy();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
