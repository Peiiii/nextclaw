import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PREFERENCE_KEYS } from "@/shared/lib/api";
import { useChatNewSessionTypePreference } from "@/features/chat/features/session-type/hooks/use-chat-new-session-type-preference";
import type { ChatSessionTypeOption } from "@/features/chat/features/session-type/utils/chat-session-type.utils";

const mocks = vi.hoisted(() => ({
  fetchPreference: vi.fn(),
  updatePreference: vi.fn(),
}));

vi.mock("@/shared/lib/api", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    fetchPreference: mocks.fetchPreference,
    updatePreference: mocks.updatePreference,
  };
});

const sessionTypeOptions: ChatSessionTypeOption[] = [
  {
    value: "native",
    label: "Native",
    icon: null,
    ready: true,
    reason: null,
    reasonMessage: null,
    supportedModels: undefined,
    recommendedModel: null,
    modelSelectionMode: "nextclaw",
    runtimeDefaultThinking: null,
    cta: null,
  },
  {
    value: "codex",
    label: "Codex",
    icon: null,
    ready: true,
    reason: null,
    reasonMessage: null,
    supportedModels: undefined,
    recommendedModel: null,
    modelSelectionMode: "runtime-default",
    runtimeDefaultThinking: null,
    cta: null,
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe("useChatNewSessionTypePreference", () => {
  beforeEach(() => {
    mocks.fetchPreference.mockReset();
    mocks.updatePreference.mockReset();
    mocks.fetchPreference.mockResolvedValue({
      key: PREFERENCE_KEYS.chat.newSessionType,
      value: null,
    });
    mocks.updatePreference.mockImplementation(
      async (key: string, value: string) => ({
        key,
        value,
        updatedAt: "2026-06-17T00:00:00.000Z",
      }),
    );
  });

  it("uses the stored new-session type when it is selectable", async () => {
    mocks.fetchPreference.mockResolvedValue({
      key: PREFERENCE_KEYS.chat.newSessionType,
      value: "codex",
    });

    const { result } = renderHook(
      () =>
        useChatNewSessionTypePreference({
          defaultSessionType: "native",
          sessionTypeOptions,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.selectedSessionType).toBe("codex");
    });
  });

  it("falls back to the default type when the stored type is not selectable", async () => {
    mocks.fetchPreference.mockResolvedValue({
      key: PREFERENCE_KEYS.chat.newSessionType,
      value: "claude",
    });

    const { result } = renderHook(
      () =>
        useChatNewSessionTypePreference({
          defaultSessionType: "native",
          sessionTypeOptions,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.selectedSessionType).toBe("native");
    });
  });

  it("persists only selectable session types", async () => {
    const { result } = renderHook(
      () =>
        useChatNewSessionTypePreference({
          defaultSessionType: "native",
          sessionTypeOptions,
        }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.setSelectedSessionType("codex");
    });

    await waitFor(() => {
      expect(mocks.updatePreference).toHaveBeenCalledWith(
        PREFERENCE_KEYS.chat.newSessionType,
        "codex",
      );
    });

    act(() => {
      result.current.setSelectedSessionType("claude");
    });

    expect(mocks.updatePreference).toHaveBeenCalledTimes(1);
  });
});
