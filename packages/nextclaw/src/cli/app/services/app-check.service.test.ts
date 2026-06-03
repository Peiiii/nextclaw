import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AppCheckService } from "./app-check.service.js";

async function createWorkspace(): Promise<string> {
  const root = path.join(
    tmpdir(),
    `nextclaw-app-check-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  await mkdir(root, { recursive: true });
  await mkdir(path.join(root, "panels"), { recursive: true });
  await mkdir(path.join(root, "service-apps"), { recursive: true });
  return root;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

describe("AppCheckService", () => {
  it("passes a valid panel app that declares matching service action and agent capability", async () => {
    const workspace = await createWorkspace();
    const servicePath = path.join(workspace, "service-apps", "workspace-files");
    const panelPath = path.join(workspace, "panels", "markdown-manager.panel");
    await mkdir(servicePath, { recursive: true });
    await mkdir(panelPath, { recursive: true });
    await writeJson(path.join(servicePath, "service-app.json"), {
      id: "workspace-files",
      title: "Workspace Files",
      protocol: "mcp",
      command: "node",
      args: ["server.mjs"],
      actions: {
        list: { risk: "read" },
      },
    });
    await writeFile(path.join(servicePath, "server.mjs"), "console.log('ok');\n");
    await writeJson(path.join(panelPath, "panel-app.json"), {
      title: "Markdown 管理器",
      description: "管理 Markdown 文件",
      icon: "📄",
      entry: "index.html",
      capabilities: ["agent:generateObject"],
      actions: ["workspace-files.list"],
    });
    await writeFile(path.join(panelPath, "index.html"), [
      "<!doctype html>",
      "<script src=\"app.js\"></script>",
    ].join("\n"));
    await writeFile(path.join(panelPath, "app.js"), [
      "window.nextclaw.agent.generateObject({",
      "  peerId: 'markdown-manager',",
      "  prompt: 'summarize',",
      "  schema: { type: 'object' }",
      "});",
      "window.nextclaw.serviceActions.invoke('workspace-files.list', {});",
    ].join("\n"));

    const report = await new AppCheckService().check(panelPath);

    expect(report.ok).toBe(true);
    expect(report.kind).toBe("panel");
    expect(report.issues).toEqual([]);
  });

  it("fails when panel code uses undeclared agent capability and service action", async () => {
    const workspace = await createWorkspace();
    const panelPath = path.join(workspace, "panels", "mood.panel");
    await mkdir(panelPath, { recursive: true });
    await writeJson(path.join(panelPath, "panel-app.json"), {
      title: "心情日记",
      description: "记录心情",
      icon: "🌈",
      entry: "index.html",
      capabilities: ["agent.generateObject"],
      actions: [],
    });
    await writeFile(path.join(panelPath, "index.html"), [
      "<!doctype html>",
      "<script>",
      "window.nextclaw.agent.generateObject({ schema: { type: 'object' } });",
      "window.nextclaw.serviceActions.invoke('mood-store.save', {});",
      "</script>",
    ].join("\n"));

    const report = await new AppCheckService().check(panelPath);

    expect(report.ok).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "panel.capability.invalid",
      "panel.capability.missing",
      "panel.action.missingDeclaration",
    ]));
  });

  it("fails when service app node script has syntax errors", async () => {
    const workspace = await createWorkspace();
    const servicePath = path.join(workspace, "service-apps", "broken-service");
    await mkdir(servicePath, { recursive: true });
    await writeJson(path.join(servicePath, "service-app.json"), {
      id: "broken-service",
      title: "Broken Service",
      protocol: "mcp",
      command: "node",
      args: ["server.mjs"],
      actions: {
        run: { risk: "read" },
      },
    });
    await writeFile(path.join(servicePath, "server.mjs"), "const value = ;\n");

    const report = await new AppCheckService().check(servicePath);

    expect(report.ok).toBe(false);
    expect(report.kind).toBe("service");
    expect(report.issues.map((issue) => issue.code)).toContain("service.command.syntaxInvalid");
  });
});
