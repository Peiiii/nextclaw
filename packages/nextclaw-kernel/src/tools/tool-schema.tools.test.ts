import { describe, expect, it, vi } from "vitest";
import type { NcpTool } from "@nextclaw/ncp";
import { executeCollectedToolCall } from "@nextclaw/ncp-agent-runtime";
import { buildProviderTools } from "@kernel/utils/agent-model-input-budget.utils.js";
import { ProjectsCreateTool } from "./project.tools.js";
import { ToolSchemaTool, selectToolModelParameters } from "./tool-schema.tools.js";

describe("tool parameter disclosure", () => {
  it("keeps declaration bytes stable after lookup and preserves execution validation", async () => {
    const createProject = vi.fn(async () => ({ name: "demo" }));
    const project = new ProjectsCreateTool({ createProject } as never);
    const tools: NcpTool[] = [project];
    const lookup = new ToolSchemaTool(() => tools);
    tools.unshift(lookup);
    const before = buildProviderTools(tools);
    expect(before[1]?.function.parameters).toEqual({ type: "object" });
    await expect(lookup.execute({ name: "projects_create" })).resolves.toMatchObject({
      parameters: { required: ["name"], properties: { template: { enum: ["empty", "knowledge-base"] } } },
    });
    expect(buildProviderTools(tools)).toEqual(before);
    const execute = (args: unknown) => executeCollectedToolCall({
      tool: project, toolCall: { toolCallId: "call", toolName: project.name, args: JSON.stringify(args) },
      execute: (tool, input) => tool!.execute(input),
    });
    const invalid = await execute({ name: "demo", template: "invented-template" });
    expect(invalid.args).toBeNull();
    expect(createProject).not.toHaveBeenCalled();
    await execute({ name: "demo", template: "empty" });
    expect(createProject).toHaveBeenCalledOnce();
  });

  it("does not expose tools outside the snapshot or return mutable schema references", async () => {
    const tool: NcpTool = { name: "visible", parameters: { type: "object", properties: { value: { type: "string" } } }, execute: vi.fn() };
    const lookup = new ToolSchemaTool(() => [tool]);
    await expect(lookup.execute({ name: "hidden" })).rejects.toThrow("allowed catalog");
    const result = await lookup.execute({ name: "visible" }) as { parameters: { type: string } };
    result.parameters.type = "array";
    expect(tool.parameters?.type).toBe("object");
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it("keeps foundational and structured-result schemas eager, and needs a lookup tool to defer", () => {
    const parameters = { type: "object", properties: { value: { type: "string", description: "contract ".repeat(30) } } };
    for (const name of ["read_file", "exec", "node_repl", "nextclaw_submit_result"]) {
      expect(selectToolModelParameters({ name, parameters, execute: vi.fn() })).toBe(parameters);
    }
    const tool = { name: "optional", parameters, execute: vi.fn() };
    expect(buildProviderTools([tool])[0]?.function.parameters).toBe(parameters);
  });
});
