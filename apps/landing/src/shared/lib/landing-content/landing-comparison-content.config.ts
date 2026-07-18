import type { ComparisonCopy, Locale } from './landing-content.types';

export const COMPARISON_COPY: Record<Locale, ComparisonCopy> = {
  en: {
    title: 'What is distinct about NextClaw?',
    subtitle:
      'It gives you an AI workspace that can run on your own infrastructure, be reshaped through open source, and grow through apps that remain usable after the coding session ends.',
    values: [
      {
        icon: 'server-cog',
        title: 'Deploy to your own Linux device, NAS, or cloud server',
        description:
          'Run NextClaw directly or with Docker on infrastructure you control, keeping its data, configuration, apps, and runtime environment with you.',
        linkLabel: 'Installation options',
        href: 'https://docs.nextclaw.io/en/guide/install'
      },
      {
        icon: 'code-xml',
        title: 'Open source and open to extension',
        description:
          'Study and learn from a clear architecture, then modify and extend the system with the models, APIs, agent runtimes, skills, and tools that fit the way you want to work.',
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
        title: '部署到自己的 Linux 设备、NAS 或云服务器',
        description: '可以直接运行或通过 Docker 部署，数据、配置、应用和运行环境都由自己掌控。',
        linkLabel: '查看安装方式',
        href: 'https://docs.nextclaw.io/zh/guide/install'
      },
      {
        icon: 'code-xml',
        title: '开放开源，可以持续改造和扩展',
        description: '源码开放、架构清晰，方便理解和学习整套 Agent 系统；也可以按自己的需要修改和扩展，接入模型、API、Agent runtime、技能和工具。',
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
