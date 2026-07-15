import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatSessionProjectDialog } from "@/features/chat/features/session/components/session-header/chat-session-project-dialog";

const pathPickerSpy = vi.fn((_props: unknown) => null);

vi.mock("@/shared/components/path-picker/server-path-picker-dialog", () => ({
  ServerPathPickerDialog: (props: unknown) => pathPickerSpy(props),
}));

describe("ChatSessionProjectDialog", () => {
  it("uses the default workspace as the browse start and quick-access location", () => {
    render(
      <ChatSessionProjectDialog
        open
        currentProjectRoot={null}
        defaultWorkspacePath="/tmp/default-workspace"
        isSaving={false}
        onOpenChange={() => undefined}
        onSave={() => undefined}
      />,
    );

    expect(pathPickerSpy).toHaveBeenCalledWith(expect.objectContaining({
      currentPath: null,
      defaultWorkspacePath: "/tmp/default-workspace",
    }));
  });

  it("prefers an explicit project over the default workdir", () => {
    render(
      <ChatSessionProjectDialog
        open
        currentProjectRoot="/tmp/project"
        defaultWorkspacePath="/tmp/default-workspace"
        isSaving={false}
        onOpenChange={() => undefined}
        onSave={() => undefined}
      />,
    );

    expect(pathPickerSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      currentPath: "/tmp/project",
      defaultWorkspacePath: "/tmp/default-workspace",
    }));
  });
});
