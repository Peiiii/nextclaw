import type { Locale, RuntimeShowcase } from "./landing-content.types";

export const RUNTIME_SHOWCASE_COPY: Record<Locale, RuntimeShowcase> = {
  en: {
    title: "Choose the execution engine for each task",
    description:
      "An Agent keeps its identity, workspace, memory, and skills. When a task starts, choose Native, Codex, Claude Code, OpenCode, or Hermes to run that session.",
    agentLabel: "Agent",
    agentDescription: "Decides who handles the task",
    runtimeLabel: "Runtime",
    runtimeDescription: "Decides how the session runs",
    runtimeNames: ["Native", "Codex", "Claude Code", "OpenCode", "Hermes"],
    imageSrc: new URL(
      "../../../../../../images/screenshots/nextclaw-agent-runtime-picker-en.png",
      import.meta.url,
    ).href,
    imageAlt:
      "NextClaw task screen with separate Agent and Agent Runtime selectors",
  },
  zh: {
    title: "为每次任务选择合适的执行引擎",
    description:
      "Agent 保留自己的身份、主目录、记忆和技能；开始新任务时，再选择 Native、Codex、Claude Code、OpenCode 或 Hermes 来执行这次会话。",
    agentLabel: "Agent",
    agentDescription: "决定由谁来处理任务",
    runtimeLabel: "Runtime",
    runtimeDescription: "决定这次会话如何执行",
    runtimeNames: ["Native", "Codex", "Claude Code", "OpenCode", "Hermes"],
    imageSrc: new URL(
      "../../../../../../images/screenshots/nextclaw-agent-runtime-picker-cn.png",
      import.meta.url,
    ).href,
    imageAlt: "NextClaw 新任务界面中独立选择 Agent 和 Agent Runtime",
  },
};
