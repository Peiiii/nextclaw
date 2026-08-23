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
  expect(screen.getAllByText("calendar.event.created")).toHaveLength(2);
  expect(screen.getByText(/calendar-extension/)).toBeTruthy();
  const eventDetails = screen.getByTestId(
    "chat-observation-event",
  ) as HTMLDetailsElement;
  expect(eventDetails.querySelector("summary")).toBeTruthy();
  expect(eventDetails.open).toBe(false);
  expect(screen.getByText(/event-1/)).toBeTruthy();
  expect(screen.getByText(/Planning/)).toBeTruthy();
  expect(screen.getByText("chatObservationEventDetailsTitle")).toBeTruthy();
  expect(screen.getByText("chatObservationEventPayloadLabel")).toBeTruthy();

  expect(eventDetails.className).toContain("my-3");
  expect(eventDetails.querySelector("summary")?.textContent).toContain(
    "calendar.event.created",
  );
  expect(eventDetails.className).not.toContain("amber");
});
