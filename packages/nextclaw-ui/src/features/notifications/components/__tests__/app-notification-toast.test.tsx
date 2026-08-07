import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppNotificationToast } from "@/features/notifications";

function CurrentPathname() {
  return <span data-testid="current-pathname">{useLocation().pathname}</span>;
}

describe("AppNotificationToast", () => {
  it("keeps opening and dismissing a route notification as separate actions", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/chat/current"]}>
        <AppNotificationToast
          title="Background task"
          description="The requested summary is ready."
          href="/chat/session-1"
          ariaLabel="Open the background task reply"
          dismissLabel="Dismiss notification"
          onDismiss={onDismiss}
        />
        <CurrentPathname />
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
    expect(notification.querySelector("button")).toBeNull();

    const dismiss = screen.getByRole("button", { name: "Dismiss notification" });
    await user.tab();
    expect(document.activeElement).toBe(notification);
    await user.tab();
    expect(document.activeElement).toBe(dismiss);
    await user.click(dismiss);
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(screen.getByTestId("current-pathname").textContent).toBe("/chat/current");

    await user.click(notification);
    expect(onDismiss).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("current-pathname").textContent).toBe("/chat/session-1");
  });

  it("lets users dismiss an informational notification without making its content interactive", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppNotificationToast
          title="All caught up"
          description="There is nothing else to review."
          dismissLabel="Dismiss notification"
          onDismiss={onDismiss}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
