import { describe, expect, it, vi } from "vitest";
import { resolveSessionContextView } from "@/lib/session-context.utils";

vi.mock("@/lib/logos", () => ({
  getChannelLogo: vi.fn(() => null),
}));

vi.mock("@/lib/i18n", () => ({
  t: (key: string) => key,
}));

describe("resolveSessionContextView", () => {
  it("prefers a declared runtime icon before falling back to a text label", () => {
    const view = resolveSessionContextView(
      {
        key: "session-1",
        createdAt: "2026-04-18T00:00:00.000Z",
        updatedAt: "2026-04-18T00:00:00.000Z",
        sessionType: "hermes",
        sessionTypeMutable: true,
        messageCount: 1,
      },
      [
        {
          value: "hermes",
          label: "Hermes",
          icon: {
            kind: "image",
            src: "app://runtime-icons/hermes-agent.png",
            alt: "Hermes",
          },
        },
      ],
    );

    expect(view).toEqual({
      icon: {
        kind: "runtime-image",
        src: "app://runtime-icons/hermes-agent.png",
        alt: "Hermes",
        name: "Hermes",
      },
      label: null,
    });
  });

  it("falls back to the resolved runtime label when no runtime icon is available", () => {
    const view = resolveSessionContextView(
      {
        key: "session-2",
        createdAt: "2026-04-18T00:00:00.000Z",
        updatedAt: "2026-04-18T00:00:00.000Z",
        sessionType: "custom-runtime",
        sessionTypeMutable: true,
        messageCount: 2,
      },
      [
        {
          value: "custom-runtime",
          label: "Custom Runtime",
          icon: null,
        },
      ],
    );

    expect(view).toEqual({
      icon: null,
      label: "Custom Runtime",
    });
  });
});
