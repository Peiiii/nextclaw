import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ChatMessageObservationEvent } from "@/features/chat/features/message/components/chat-message-observation-event";

vi.mock("@/app/components/i18n-provider", () => ({
  useI18n: () => ({ language: "en" }),
}));

vi.mock("@/shared/lib/i18n", () => ({
  formatDateTime: (value: string) => `formatted:${value}`,
  t: (key: string) => key,
}));

it("shows the event identity and keeps the payload behind an expandable detail", () => {
  render(
    <ChatMessageObservationEvent
      event={{
        deliveryId: "delivery-1",
        extensionId: "calendar-extension",
        eventId: "event-1",
        eventType: "calendar.event.created",
        occurredAt: "2026-08-23T10:00:00.000Z",
        payload: { title: "Planning" },
      }}
    />,
  );

  expect(screen.getByTestId("chat-observation-event")).toBeTruthy();
  expect(screen.getByText("calendar.event.created")).toBeTruthy();
  expect(screen.getByText(/calendar-extension/)).toBeTruthy();
  const summary = screen.getByText("chatObservationEventShowDetails");
  expect(summary).toBeTruthy();
  expect(summary.closest("details")?.open).toBe(false);
  expect(screen.getByText(/Planning/)).toBeTruthy();
});
