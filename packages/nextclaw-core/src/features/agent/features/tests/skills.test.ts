import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { SkillsLoader } from "@core/features/agent/services/skills-loader.service.js";

const tempWorkspaces: string[] = [];

function createWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-skills-test-"));
  tempWorkspaces.push(workspace);
  return workspace;
}

afterEach(() => {
  while (tempWorkspaces.length > 0) {
    const workspace = tempWorkspaces.pop();
    if (!workspace) {
      continue;
    }
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe("SkillsLoader visualization builtin", () => {
  it("loads the focused output visualization skill", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);
    const skill = loader.loadSkill("visualize-output");

    expect(skill).toContain("选择展示方式");
    expect(skill).toContain("nextclaw-inline");
    expect(skill).toContain('"viewer":"rendered"');
    expect(skill).toContain("把整个 HTML 文档当成唯一展示表面");
    expect(skill).toContain("不要再放带背景、外边框、圆角或阴影的根容器");
    expect(skill).toContain("默认不放可见的页面标题、眉题、报告名或说明横幅");
    expect(skill).toContain("默认不使用 KPI 卡片、洞察框、章节卡片");
    expect(skill).toContain("`nextclaw-inline.title` 只是宿主元数据");
    expect(skill).toContain("无论用户是否说出“内联”");
    expect(skill).toContain("不要用表格、列表、数据速览或第二种图表重复");
    expect(skill).toContain("最终可见内容必须只有 `nextclaw-inline` 声明");
    expect(skill).toContain("不得输出核对表、计算过程、“检查通过”、引导语或数据复述");
    expect(skill).toContain("区间首尾增幅不能写成累计增长");
    expect(skill).toContain("用户可见数据白名单");
    expect(skill).toContain("总体目标只能与同口径的总体实际值比较");
    expect(skill).toContain("没有用户提供的类别目标，就不展示任何类别目标语义");
    expect(skill).toContain("必须先用计算工具或 `exec` 得到结果");
    expect(skill).toContain("重新读取最终 HTML");
    expect(skill).toContain("NEXTCLAW_HOME/assets/visualizations/<session-id>/");
    expect(skill).toContain("不得放到 `/tmp`、其他临时目录、当前项目或工作目录根部");
    expect(skill).toContain("并在声明中使用绝对路径");
    expect(skill).toContain("min(80vh, 720px)");
    expect(skill).toContain("不要在 HTML 内重复文件名");
    expect(skill).toContain("不依赖 document 级内部滚动");
    expect(skill).toContain("nextclaw-app-creator");
  });
});

describe("SkillsLoader skill sources", () => {
  it("loads and groups project, NextClaw workspace, and global Agent Skills", () => {
    const workspace = createWorkspace();
    const projectRoot = join(workspace, "project");
    const globalSkillsRoot = join(workspace, "global-agent-skills");
    const skillRoots = [
      [join(projectRoot, ".agents", "skills"), "project-review"],
      [join(workspace, "skills"), "workspace-review"],
      [globalSkillsRoot, "global-review"],
    ] as const;
    for (const [skillsRoot, name] of skillRoots) {
      const skillDir = join(skillsRoot, name);
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(
        join(skillDir, "SKILL.md"),
        ["---", `name: ${name}`, `description: ${name} instructions`, "---"].join("\n"),
      );
    }

    const loader = new SkillsLoader({
      workspace,
      projectRoot,
      includeBuiltin: false,
      includeGlobal: true,
      globalSkillsRoot,
    });

    expect(loader.listSkills(false)).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "project-review", scope: "project" }),
      expect.objectContaining({ name: "workspace-review", scope: "workspace" }),
      expect.objectContaining({ name: "global-review", scope: "global" }),
    ]));
    const summary = loader.buildSkillsSummary();
    const projectGroupIndex = summary.indexOf('<skill_group scope="project" source="project">');
    const workspaceGroupIndex = summary.indexOf('<skill_group scope="workspace" source="workspace">');
    const globalGroupIndex = summary.indexOf('<skill_group scope="global" source="global">');
    expect(projectGroupIndex).toBeGreaterThan(-1);
    expect(workspaceGroupIndex).toBeGreaterThan(projectGroupIndex);
    expect(globalGroupIndex).toBeGreaterThan(workspaceGroupIndex);
  });

  it("loads builtin skills even when the workspace has no copied skill directories", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);

    const skill = loader.listSkills(false).find((entry) => entry.name === "nextclaw-self-manage");

    expect(skill).toEqual(
      expect.objectContaining({
        name: "nextclaw-self-manage",
        source: "builtin",
        scope: "builtin",
      }),
    );
  });

  it("loads the NextClaw autostart builtin skill", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);

    const skill = loader.listSkills(false).find((entry) => entry.name === "nextclaw-autostart");

    expect(skill).toEqual(
      expect.objectContaining({
        name: "nextclaw-autostart",
        source: "builtin",
        scope: "builtin",
      }),
    );
    expect(loader.loadSkill("nextclaw-autostart")).toContain("nextclaw service autostart status");
  });

  it("documents Panel App Agent APIs in the builtin panel app creator skill", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);
    const skill = loader.loadSkill("panel-app-creator");

    expect(skill).toContain("window.nextclaw.agent.generateObject");
    expect(skill).toContain("window.nextclaw.agent.send");
    expect(skill).toContain("references/panel-app-bridge-api.md");
    expect(skill).toContain("peerId");
    expect(skill).toContain("不要自己生成、缓存或猜测稳定 `sessionId`");
    expect(skill).toContain("窄侧栏优先布局");
    expect(skill).toContain("320px-480px");
    expect(skill).toContain("Panel Card 体验合同");
    expect(skill).toContain("不要把普通右侧面板、编辑器、管理页、大表格或多页工作流硬做成卡片");
    expect(skill).toContain("首屏 `220px-420px` 高度内必须看见核心价值");
    expect(skill).toContain("横向优先");
    expect(skill).toContain("宽度大于高度");
    expect(skill).toContain("设计上不要依赖 document 级内部滚动");
    expect(skill).toContain("nextclawDisplayMode=card");
    expect(skill).toContain("必须输出 `nextclaw-inline` fenced JSON block");
    expect(skill).toContain("不要调用 `show_panel_app` 做 inline 展示");
    expect(skill).toContain("side panel 即时预览");
    expect(skill).toContain("nextclaw-inline");
    expect(skill).toContain("新建或重写 Panel App 时只使用目录式 Panel App");
    expect(skill).toContain("panel-app-react-vite-creator");
    expect(skill).toContain("前端工程形态判断");
    expect(skill).toContain("先主动判断是否需要工程化 `React + Vite + TypeScript + Tailwind CSS + pnpm`");
    expect(skill).toContain("`panel-app.json` 是标题、描述、图标、入口、Agent capabilities 和 Service actions 的唯一 manifest 事实源");
    expect(skill).toContain("创建或修改 Panel App 后不需要重启 NextClaw 宿主");
    expect(skill).toContain("\"capabilities\": [\"agent:generateObject\", \"agent:send\"]");
    expect(skill).toContain("agent:generateObject");
    expect(skill).toContain("agent:send");
    expect(skill).toContain("\"actions\": [\"workspace-files.list\", \"workspace-files.read\"]");
    expect(skill).toContain("不要在 HTML `<head>` 中添加 NextClaw manifest meta");
    expect(skill).toContain("`list()` 返回 action 数组");
    expect(skill).toContain("`invoke()` 已由宿主 SDK 解包");
    expect(skill).toContain("不要为了 AI 分析新建 Service App 自己调用模型");
  });

  it("loads the NextClaw app creator orchestration skill", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);
    const skill = loader.loadSkill("nextclaw-app-creator");

    expect(skill).toContain("Panel-only");
    expect(skill).toContain("Service-only");
    expect(skill).toContain("Panel + Service");
    expect(skill).toContain("panel-app-creator");
    expect(skill).toContain("service-app-creator");
    expect(skill).toContain("panel-app-react-vite-creator");
    expect(skill).toContain("完成 Panel/Service 形态判断后，再判断前端工程形态");
    expect(skill).toContain("React + Vite + TypeScript + Tailwind CSS + pnpm");
    expect(skill).toContain("AI 应用、对话体验、需要 App Client 类型");
    expect(skill).toContain("window.nextclaw.serviceActions.invoke()");
    expect(skill).toContain("window.nextclaw.agent.generateObject()");
    expect(skill).toContain("不要外部生成稳定 `sessionId`");
    expect(skill).toContain("创建目录式 Panel App");
    expect(skill).toContain("`panel-app.json` 是 Panel App 标题、入口、图标、Agent capabilities 和 Service action allowlist 的唯一事实源");
    expect(skill).toContain("Service Actions 当前推荐继续使用旧 bridge");
    expect(skill).toContain("只有明确需要旧 bridge 的 `generateObject()` 便利层时才走 `window.nextclaw.agent.generateObject()`");
    expect(skill).toContain("`window.nextclaw.serviceActions.list()` 返回数组");
    expect(skill).toContain("Service App 零依赖优先");
    expect(skill).toContain("创建或修改 Panel App / Service App 后，默认不需要重启 NextClaw 宿主");
    expect(skill).toContain("交付说明不要让用户 restart");
    expect(skill).toContain("Panel App、编辑器、管理页、大表格和多页工作流应使用 side panel");
    expect(skill).toContain("普通 inline Panel App 展示必须输出 `nextclaw-inline`");
    expect(skill).toContain("不要调用 `show_panel_app` 做 inline 展示");
    expect(skill).toContain("只用于 side panel 即时预览");
    expect(skill).toContain("nextclaw-inline");
    expect(skill).toContain('show_file(path, viewer="rendered")');
    expect(skill).toContain("show_url(url)");
    expect(skill).not.toContain('placement="side_panel"');
    expect(skill).toContain('viewer="source"');
  });

  it("loads the React/Vite Panel App creator builtin skill", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);
    const skill = loader.loadSkill("panel-app-react-vite-creator");

    expect(skill).toContain("pnpm");
    expect(skill).toContain("Vite");
    expect(skill).toContain("React");
    expect(skill).toContain("Tailwind");
    expect(skill).toContain("base: \"./\"");
    expect(skill).toContain("静态 `.panel` 目录");
    expect(skill).toContain("不要让 NextClaw 宿主运行 `vite dev`");
    expect(skill).toContain("show_url(url)");
    expect(skill).not.toContain('placement="side_panel"');
    expect(skill).toContain("pnpm add -D @nextclaw/client-sdk");
    expect(skill).toContain("import type { NextClawAppClient } from \"@nextclaw/client-sdk\"");
    expect(skill).toContain("真实 client 必须来自宿主同步注入的 `window.nextclaw.client`");
    expect(skill).toContain("不要凭记忆写 `panelApps.*`");
    expect(skill).toContain("nextclaw app check");
  });

  it("documents the Service App bridge payload contract", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);
    const skill = loader.loadSkill("service-app-creator");

    expect(skill).toContain("Service App 只负责浏览器做不了或不该做的后端动作");
    expect(skill).toContain("AI 分析、总结、分类、结构化 JSON 输出默认走 Panel App 的 `window.nextclaw.agent.generateObject()`");
    expect(skill).toContain("`serviceActions.list()` 返回 action 数组");
    expect(skill).toContain("`serviceActions.invoke()` 返回业务 payload");
    expect(skill).toContain("如果 MCP tool result 使用 `structuredContent`");
    expect(skill).toContain("默认优先做零依赖 Service App");
    expect(skill).toContain("零依赖优先：能用 Node.js 内置模块完成");
    expect(skill).toContain("Service App 可以自由使用第三方包");
    expect(skill).toContain("@modelcontextprotocol/sdk");
    expect(skill).toContain("不要假设用户已经手动装过");
    expect(skill).toContain("创建或修改 Service App 后不需要重启 NextClaw 宿主");
  });

  it("keeps builtin skill descriptions bilingual", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);
    const builtinSkills = loader.listSkills(false).filter((entry) => entry.source === "builtin");

    expect(builtinSkills.length).toBeGreaterThan(0);
    for (const skill of builtinSkills) {
      const metadata = loader.getSkillMetadata(skill) ?? {};
      expect(metadata.description?.trim(), skill.name).toBeTruthy();
      expect(
        (metadata.description_zh ?? metadata.descriptionZh)?.trim(),
        skill.name,
      ).toBeTruthy();
    }
  });

  it("does not let a workspace copy shadow a builtin skill with the same name", () => {
    const workspace = createWorkspace();
    const copiedDir = join(workspace, "skills", "nextclaw-self-manage");
    mkdirSync(copiedDir, { recursive: true });
    writeFileSync(
      join(copiedDir, "SKILL.md"),
      [
        "---",
        "name: nextclaw-self-manage",
        "description: stale workspace copy",
        "---",
        "",
        "Stale copy.",
      ].join("\n"),
    );

    const loader = new SkillsLoader(workspace);
    const matches = loader.listSkills(false).filter((entry) => entry.name === "nextclaw-self-manage");

    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual(
      expect.objectContaining({
        source: "builtin",
        scope: "builtin",
      }),
    );
    expect(matches[0]?.path.startsWith(workspace)).toBe(false);
  });

  it("keeps always-on builtin skills active", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);

    expect(loader.getAlwaysSkills()).toContainEqual(
      expect.stringContaining("builtin:"),
    );
    expect(loader.getAlwaysSkills()).toContainEqual(
      expect.stringContaining("nextclaw-self-manage"),
    );
  });
});
