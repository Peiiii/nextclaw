import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectAgreement } from "./project-agreement";
import { ProjectSkills } from "./project-skills";

describe("project materials", () => {
  it("opens the root agreement and renders a missing-file empty state", () => {
    const onOpenFile = vi.fn();
    const { rerender } = render(
      <ProjectAgreement
        agreement={{ path: "AGENTS.md", available: true }}
        isLoading={false}
        isError={false}
        onOpenFile={onOpenFile}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /AGENTS\.md/ }));
    expect(onOpenFile).toHaveBeenCalledWith("AGENTS.md", "AGENTS.md");

    rerender(
      <ProjectAgreement
        agreement={{ path: "AGENTS.md", available: false }}
        isLoading={false}
        isError={false}
        onOpenFile={onOpenFile}
      />,
    );
    expect(
      screen.getByText(/No AGENTS\.md exists|还没有 AGENTS\.md/),
    ).toBeTruthy();
  });

  it("opens project skills from the fixed source and renders an empty state", () => {
    const onOpen = vi.fn();
    const skill = {
      ref: "project:alpha",
      name: "alpha",
      description: "Alpha project skill",
      path: ".agents/skills/alpha/SKILL.md",
    };
    const { rerender } = render(
      <ProjectSkills
        skills={[skill]}
        isLoading={false}
        isError={false}
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /alpha/ }));
    expect(onOpen).toHaveBeenCalledWith(skill);

    rerender(
      <ProjectSkills
        skills={[]}
        isLoading={false}
        isError={false}
        onOpen={onOpen}
      />,
    );
    expect(
      screen.getByText(/No project Skills found|暂无项目 Skills/),
    ).toBeTruthy();
  });

  it("shows bounded loading and error states", () => {
    const { rerender } = render(
      <ProjectSkills skills={[]} isLoading isError={false} onOpen={vi.fn()} />,
    );
    expect(screen.getByText(/Loading project|正在读取项目/)).toBeTruthy();

    rerender(
      <ProjectSkills skills={[]} isLoading={false} isError onOpen={vi.fn()} />,
    );
    expect(
      screen.getByText(/Failed to load project|项目读取失败/),
    ).toBeTruthy();
  });
});
