import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppNotificationToast } from "@/features/notifications";

describe("AppNotificationToast", () => {
  it("renders a keyboard-accessible route notification and dismisses it on activation", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppNotificationToast
          title="Background task"
          description="The requested summary is ready."
          href="/chat/session-1"
          ariaLabel="Open the background task reply"
          onDismiss={onDismiss}
        />
      </MemoryRouter>,
    );

    const notification = screen.getByRole("link", {
      name: "Open the background task reply",
    });
    expect(notification.getAttribute("href")).toBe("/chat/session-1");
    expect(notification.className).not.toMatch(
      /(?:hover|active):bg-\S*\/\d+/,
    );
    expect(screen.getByText("Background task")).toBeTruthy();
    expect(screen.getByText("The requested summary is ready.")).toBeTruthy();

    await user.click(notification);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("keeps informational notifications non-interactive when no route exists", () => {
    render(
      <MemoryRouter>
        <AppNotificationToast
          title="All caught up"
          description="There is nothing else to review."
          onDismiss={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
