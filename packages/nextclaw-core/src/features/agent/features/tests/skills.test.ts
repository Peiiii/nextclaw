import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { estimateInputTokens } from "@core/features/agent/services/input-budget-pruner.service.js";
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
    expect(skill).toContain("min(90vh, 1440px)");
    expect(skill).toContain("不要在 HTML 内重复文件名");
    expect(skill).toContain("不依赖 document 级内部滚动");
    expect(skill).toContain("nextclaw-app-creator");
  });
});

describe("SkillsLoader always skills", () => {
  it("loads the always-on continuous attention skill", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);
    const skill = loader.loadSkill("continuous-attention");
    const entry = loader
      .listSkills(false)
      .find(({ name }) => name === "continuous-attention");
    const metadata = entry ? loader.getSkillMetadata(entry) : null;

    expect(skill).toContain("bind_context");
    expect(skill).toContain("subscribe_events");
    expect(skill).toContain("manage_observations");
    expect(skill).toContain("Context Binding");
    expect(skill).toContain("Event Subscription");
    expect(metadata?.metadata).toContain('"always":true');
    expect(loader.getAlwaysSkills()).toContain(entry?.ref);
  });
});

describe("SkillsLoader result delivery policy", () => {
  it("routes durable results to the inbox without guessing an external channel", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);
    const skill = loader.loadSkill("cross-channel-messaging");
    const entry = loader.listSkills(false).find(({ name }) => name === "cross-channel-messaging");
    const metadata = entry ? loader.getSkillMetadata(entry) : null;

    expect(metadata?.description).toContain("put durable news, reports, recommendations, or articles");
    expect(metadata?.description_zh).toContain("投递到 NextClaw 收件箱");
    expect(skill).toContain("Use `deliver_to_inbox` for news digests");
    expect(skill).toContain('"Send it to me" or "notify me" alone is not an external route');
    expect(skill).toContain("Do not infer Weixin");
    expect(skill).toContain("normal reply, `deliver_to_inbox`, and `message`");
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
    const projectGroupIndex = summary.indexOf("### project skills");
    const workspaceGroupIndex = summary.indexOf("### workspace skills");
    const globalGroupIndex = summary.indexOf("### global skills");
    expect(projectGroupIndex).toBeGreaterThan(-1);
    expect(workspaceGroupIndex).toBeGreaterThan(projectGroupIndex);
    expect(globalGroupIndex).toBeGreaterThan(workspaceGroupIndex);
    expect(summary).toContain(`Root: \`${join(projectRoot, ".agents", "skills")}\``);
    expect(summary).toContain("- project-review — project-review instructions");
    expect(summary).toContain("- workspace-review — workspace-review instructions");
    expect(summary).toContain("- global-review — global-review instructions");
    expect(summary).not.toContain("<skill");
    expect(summary).not.toContain("<ref>");
    expect(summary).not.toContain("<location>");
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
});

describe("SkillsLoader Mini App creation", () => {

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
    expect(skill).toContain("完整、可安装、可发布或长期维护的 schema v2 Mini App");
    expect(skill).toContain("`panels/<panel-id>.panel/`");
    expect(skill).toContain("Panel bridge 不按 runtime 分叉");
    expect(skill).toContain("nextclaw app check <app-dir> --json");
  });

  it("loads the NextClaw app creator orchestration skill", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);
    const skill = loader.loadSkill("nextclaw-app-creator");

    expect(skill).toContain("Panel-only");
    expect(skill).toContain("Service-only");
    expect(skill).toContain("Panel + Service");
    expect(skill).toContain("组件组成和 Service runtime 是两条正交维度");
    expect(skill).toContain("不是三个并列 App 类型");
    expect(skill).toContain("Portable WASI 与 native-process 只用于比较 Service 组件如何运行");
    expect(skill).toContain("Portable WASI");
    expect(skill).toContain("native-process");
    expect(skill).toContain("panel-app-creator");
    expect(skill).toContain("service-app-creator");
    expect(skill).toContain("panel-app-react-vite-creator");
    expect(skill).toContain("React + Vite + TypeScript + Tailwind CSS + pnpm");
    expect(skill).toContain("window.nextclaw.serviceActions.invoke()");
    expect(skill).toContain("window.nextclaw.agent.generateObject()");
    expect(skill).toContain("`window.nextclaw.serviceActions.invoke()`");
    expect(skill).toContain("开发机器需要 `cargo`、`rustc` 和 `wasm32-wasip2`");
    expect(skill).toContain("最终用户安装、启用和运行已经构建好的 Portable `.napp` 不需要 Rust");
    expect(skill).toContain("纯 Panel 不需要 Rust");
    expect(skill).toContain("开发机缺少 Rust 不是把安全边界静默降级为 native-process 的充分理由");
    expect(skill).toContain("nextclaw app create <app-dir> --template rust-wasi");
    expect(skill).toContain("build → check → test → dev → call");
    expect(skill).toContain("schema v2 包根");
    expect(skill).toContain("service-components/<service-id>/");
    expect(skill).not.toContain("当前 schema v2 Service App 使用 `service-app.json` 的 `command/args`");
    expect(skill).not.toContain("当前没有 schema v2 WASI");
    expect(skill).toContain("nextclaw-inline");
    expect(skill).toContain('show_file(path, viewer="rendered")');
    expect(skill).toContain("show_url(url)");
    expect(skill).not.toContain('placement="side_panel"');
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
    expect(skill).toContain("`<app-dir>/panels/<panel-id>.panel/`");
    expect(skill).toContain("schema v2 包内 Panel 必须从包根运行");
  });

  it("routes Service Apps between Portable WASI and native-process contracts", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);
    const skill = loader.loadSkill("service-app-creator");
    const skillRoot = new URL("../../shared/skills/service-app-creator/", import.meta.url);
    const portable = readFileSync(new URL("references/portable-wasi-service-app.md", skillRoot), "utf8");
    const nativeProcess = readFileSync(new URL("references/native-process-service-app.md", skillRoot), "utf8");

    expect(skill).toContain("Portable WASI Service");
    expect(skill).toContain("native-process Service");
    expect(skill).toContain("references/portable-wasi-service-app.md");
    expect(skill).toContain("references/native-process-service-app.md");
    expect(skill).toContain("nextclaw app doctor --profile wasi");
    expect(skill).toContain("安装和运行已经构建好的");
    expect(skill).toContain("Panel 不需要知道后端是 WASI 还是 native-process");
    expect(skill).not.toContain("当前没有 schema v2 WASI Service component 合同");

    expect(portable).toContain("nextclaw app create <app-dir> --template rust-wasi");
    expect(portable).toContain('"protocol": "wasi-component"');
    expect(portable).toContain("Action");
    expect(portable).toContain("Resident");
    expect(portable).toContain("Provider");
    expect(portable).toContain("nextclaw app test . --json");
    expect(portable).toContain("Rust 是本机构建依赖，不是安装后运行依赖");

    expect(nativeProcess).toContain('"protocol": "mcp"');
    expect(nativeProcess).toContain('"command": "node"');
    expect(nativeProcess).toContain("默认优先零依赖 `server.mjs`");
    expect(nativeProcess).toContain("@modelcontextprotocol/sdk");
    expect(nativeProcess).toContain("不是 OS 进程沙箱");
  });
});

describe("SkillsLoader builtin metadata", () => {

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
});

describe("SkillsLoader catalog prompt", () => {
  it("keeps the complete builtin catalog compact without XML or description loss", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader({
      workspace,
      includeBuiltin: true,
      includeGlobal: false,
    });
    const skills = loader.listSkills(true);
    const summary = loader.buildSkillsSummary();

    for (const skill of skills) {
      const description = loader.getSkillMetadata(skill)?.description?.trim();
      expect(summary).toContain(`- ${skill.name} — ${description}`);
    }
    expect(summary).not.toContain("<skill");
    expect(summary).not.toContain("<ref>");
    expect(summary).not.toContain("<location>");
    expect(
      estimateInputTokens([{ role: "system", content: summary }]),
    ).toBeLessThan(1_400);
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

describe("SkillsLoader Mini App publishing", () => {
  it("loads the native NextClaw Mini App publisher skill", () => {
    const workspace = createWorkspace();
    const loader = new SkillsLoader(workspace);
    const skill = loader.loadSkill("nextclaw-app-publisher");
    const creator = loader.loadSkill("nextclaw-app-creator");

    expect(skill).toContain("nextclaw account status --json");
    expect(skill).toContain("nextclaw app validate-publish");
    expect(skill).toContain("nextclaw app publish");
    expect(skill).toContain("Portable WASI");
    expect(skill).toContain("native-process");
    expect(skill).toContain("Panel-only 与 Portable WASI、native-process 不是同一层的三个选项");
    expect(skill).toContain('`protocol: "wasi-component"`');
    expect(skill).toContain('`protocol: "mcp"`');
    expect(skill).toContain("最终用户安装、启用和运行已构建的 Portable `.napp` 不需要 Rust");
    expect(skill).toContain("nextclaw app test <app-dir> --json");
    expect(skill).toContain("distribution.targets");
    expect(skill).toContain("publishStatus: pending");
    expect(skill).toContain("已提交审核，尚未出现在 Marketplace");
    expect(skill).not.toContain("napp publish");
    expect(skill).not.toContain("当前没有 schema v2 WASI Service 执行合同");
    expect(skill).not.toContain("schema v2 Service components do not support a WASI runtime yet");
    expect(creator).toContain("nextclaw-app-publisher");
    expect(creator).toContain("nextclaw app validate-publish/publish");
  });
});
