import type { ComparisonCopy, Locale } from './landing-content.types';

export const COMPARISON_COPY: Record<Locale, ComparisonCopy> = {
  en: {
    title: 'What is distinct about NextClaw?',
    subtitle:
      'It gives you an AI workspace that can run on your own infrastructure, be reshaped through open source, and grow through apps that remain usable after the coding session ends.',
    values: [
      {
        icon: 'server-cog',
        title: 'Keep NextClaw running on your own VPS, NAS, or Linux device',
        description:
          'Unused messaging channels do not keep separate processes resident. NextClaw stays lean while idle and starts channel runtimes only when you enable or use them.',
        linkLabel: 'Deployment and resource usage',
        href: 'https://docs.nextclaw.io/en/guide/resource-usage'
      },
      {
        icon: 'code-xml',
        title: 'Open source, scriptable, and open to extension',
        description:
          'Study and extend a clear architecture, and use core operations through the nextclaw CLI from a terminal, script, CI job, or another Agent.',
        linkLabel: 'View the source',
        href: 'https://github.com/Peiiii/nextclaw'
      },
      {
        icon: 'panels-top-left',
        title: 'Make your Vibe Coding apps more than disposable prototypes',
        description:
          'Run and preview a generated app beside the agent, pin it to the global side dock, reopen it later, and keep iterating instead of leaving behind disposable code.',
        linkLabel: 'Explore Panel Apps',
        href: 'https://docs.nextclaw.io/en/guide/panel-apps'
      }
    ]
  },
  zh: {
    title: 'NextClaw 有哪些独特价值？',
    subtitle: '它提供一套可以运行在自己设备上、基于开源持续改造，并通过可长期使用的小应用不断扩展的 AI 工作环境。',
    values: [
      {
        icon: 'server-cog',
        title: '让 NextClaw 在自己的 VPS、NAS 或 Linux 设备上长期运行',
        description: '未启用的消息渠道不会常驻独立进程。空闲时保持轻量，需要启用或使用渠道时再按需启动。',
        linkLabel: '查看部署与资源占用',
        href: 'https://docs.nextclaw.io/zh/guide/resource-usage'
      },
      {
        icon: 'code-xml',
        title: '开放开源，也方便通过命令行集成',
        description: '源码开放、架构清晰，方便理解和扩展整套 Agent 系统；核心操作也可以通过 nextclaw 命令行接入终端、脚本、CI 或其他 Agent。',
        linkLabel: '查看源代码',
        href: 'https://github.com/Peiiii/nextclaw'
      },
      {
        icon: 'panels-top-left',
        title: '让你的 Vibe Coding 小应用不再日抛',
        description: '生成后直接在 Agent 旁运行和预览，固定到全局边栏，随时重新打开并继续修改，不再只留下一份日抛代码。',
        linkLabel: '了解 Panel Apps',
        href: 'https://docs.nextclaw.io/zh/guide/panel-apps'
      }
    ]
  }
};
