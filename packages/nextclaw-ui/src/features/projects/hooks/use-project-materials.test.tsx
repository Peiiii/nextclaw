import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useProjectAgreement,
  useProjectSkills,
} from "@/features/projects/hooks/use-project-materials";
import { nextclawClient } from "@/shared/lib/api";

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("project material queries", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("loads agreement and skills independently", async () => {
    const getAgreement = vi
      .spyOn(nextclawClient.projects, "getAgreement")
      .mockResolvedValue({ path: "AGENTS.md", available: true });
    const listProjectSkills = vi
      .spyOn(nextclawClient.projects, "listProjectSkills")
      .mockResolvedValue([
        {
          ref: "project:alpha",
          name: "alpha",
          path: ".agents/skills/alpha/SKILL.md",
        },
      ]);

    const agreement = renderHook(() => useProjectAgreement("project-1"), {
      wrapper: createWrapper(),
    });
    const skills = renderHook(() => useProjectSkills("project-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(agreement.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(skills.result.current.isSuccess).toBe(true));
    expect(getAgreement).toHaveBeenCalledWith("project-1");
    expect(listProjectSkills).toHaveBeenCalledWith("project-1");
  });

  it("does not query without a selected project", () => {
    const getAgreement = vi.spyOn(nextclawClient.projects, "getAgreement");
    const listProjectSkills = vi.spyOn(
      nextclawClient.projects,
      "listProjectSkills",
    );

    renderHook(() => useProjectAgreement(null), { wrapper: createWrapper() });
    renderHook(() => useProjectSkills(null), { wrapper: createWrapper() });

    expect(getAgreement).not.toHaveBeenCalled();
    expect(listProjectSkills).not.toHaveBeenCalled();
  });
});
