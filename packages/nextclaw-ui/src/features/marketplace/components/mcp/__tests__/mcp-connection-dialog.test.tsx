import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { McpConnectionDialog } from "../mcp-connection-dialog";

describe("McpConnectionDialog", () => {
  it("requires a successful test before saving a stdio connection", async () => {
    const onTest = vi.fn(async () => ({ name: "local-tools", transport: "stdio" as const, accessible: true, toolCount: 2 }));
    const onSave = vi.fn(async () => undefined);
    render(<McpConnectionDialog open testing={false} saving={false} onOpenChange={vi.fn()} onTest={onTest} onSave={onSave} />);

    const saveButton = screen.getByRole("button", { name: "Save connection" });
    expect(saveButton.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "local-tools" } });
    fireEvent.change(screen.getByLabelText("Command"), { target: { value: "node" } });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    await waitFor(() => expect(onTest).toHaveBeenCalledOnce());
    expect(await screen.findByText("Connected. Found 2 tools.")).not.toBeNull();
    expect(saveButton.hasAttribute("disabled")).toBe(false);
    fireEvent.click(saveButton);
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
  });
});
