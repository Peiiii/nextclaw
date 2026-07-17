import type { ComparisonCopy, Locale } from './landing-content.types';

export const COMPARISON_COPY: Record<Locale, ComparisonCopy> = {
  en: {
    eyebrow: 'Choosing the right fit',
    title: 'Different products are best suited to different kinds of work.',
    subtitle:
      'All three can complete multi-step work. A more useful comparison is where tasks usually begin, what each product is designed to carry through, and which capabilities you want to keep under your control.',
    startLabel: 'Work usually starts with',
    focusLabel: 'Product center of gravity',
    bestForLabel: 'Prioritize it when',
    lanes: [
      {
        product: 'NextClaw',
        category: 'Open personal AI operating layer',
        icon: 'panels-top-left',
        start: 'A real task that may involve research, data, writing, code, local files, messaging channels, or a small app.',
        focus: 'Carrying one task across models, agents, browser work, local files, channels, schedules, and interactive results without breaking it into separate products.',
        bestFor: 'Your work often crosses research, content, data, code, files, and communication, and you also want an open, self-hostable workbench you can keep under your control.',
        sourceLabel: 'Product docs',
        sourceUrl: 'https://docs.nextclaw.io/en/guide/introduction',
        featured: true
      },
      {
        product: 'WorkBuddy',
        category: 'AI office workbench',
        icon: 'briefcase-business',
        start: 'Documents, spreadsheets, presentations, research, and Tencent workplace services.',
        focus: 'Planning tasks and delivering knowledge-work results inside an integrated commercial workspace.',
        bestFor: 'You want an out-of-the-box office agent, especially around the Tencent productivity ecosystem.',
        sourceLabel: 'Official overview',
        sourceUrl: 'https://www.codebuddy.cn/docs/workbuddy/Overview'
      },
      {
        product: 'Codex',
        category: 'Software engineering agent',
        icon: 'code-2',
        start: 'A repository, issue, pull request, terminal, or development environment.',
        focus: 'Understanding, changing, testing, reviewing, and shipping software with parallel agents.',
        bestFor: 'Most of the value you need is engineering work and the primary deliverable is code.',
        sourceLabel: 'Official overview',
        sourceUrl: 'https://openai.com/codex/'
      }
    ],
    proofTitle: 'Work that fits naturally in NextClaw',
    proofDescription: 'Its value becomes clearer when a task crosses several steps, needs local context, or should keep running beyond a single answer.',
    proofs: [
      {
        icon: 'bar-chart-3',
        title: 'Research, analyze, and deliver one report',
        description: 'Collect pages, CSVs, or spreadsheets, build charts, and deliver the conclusions with their source material.',
        linkLabel: 'Task example',
        href: 'https://docs.nextclaw.io/en/guide/create-task'
      },
      {
        icon: 'messages-square',
        title: 'Turn a chat request into completed work',
        description: 'Let a request arrive from Weixin, Feishu, or another channel, continue the deeper work locally, then return the result.',
        linkLabel: 'Message channels',
        href: 'https://docs.nextclaw.io/en/guide/channels'
      },
      {
        icon: 'files',
        title: 'Work directly with local files and projects',
        description: 'Read or change files, then inspect Markdown, source code, charts, and rendered HTML beside the conversation.',
        linkLabel: 'Review results',
        href: 'https://docs.nextclaw.io/en/guide/results'
      },
      {
        icon: 'app-window',
        title: 'Build a small app you can keep using',
        description: 'Turn an analysis, dashboard, form, or repeated workflow into an interactive Panel App beside the task.',
        linkLabel: 'Panel Apps',
        href: 'https://docs.nextclaw.io/en/guide/panel-apps'
      },
      {
        icon: 'calendar-clock',
        title: 'Keep recurring work moving on schedule',
        description: 'Run a daily brief, health check, reminder, or periodic summary after the workflow has been verified once.',
        linkLabel: 'Recurring work',
        href: 'https://docs.nextclaw.io/en/guide/after-setup'
      },
      {
        icon: 'waypoints',
        title: 'Use a specialist agent for each part',
        description: 'Choose Native, Codex, Claude Code, or Hermes for the task at hand while keeping the work visible in NextClaw.',
        linkLabel: 'Runtime guide',
        href: 'https://docs.nextclaw.io/en/guide/tutorials/claude-codex-hermes'
      }
    ],
    sourceNote:
      'Compared from public product materials and currently verifiable NextClaw capabilities on July 16, 2026. Products change; follow the linked official pages for current details.'
  },
  zh: {
    eyebrow: '选型参考',
    title: '不同产品，适合不同的工作重心。',
    subtitle: '三者都能处理复杂、多步骤任务。更有意义的比较是：任务通常从哪里开始，产品最擅长承接什么，以及你希望把哪些能力长期留在自己手里。',
    startLabel: '通常从这里开始',
    focusLabel: '产品重心',
    bestForLabel: '优先考虑它，当你',
    lanes: [
      {
        product: 'NextClaw',
        category: '开放的个人 AI 操作层',
        icon: 'panels-top-left',
        start: '一个可能同时涉及调研、数据、写作、代码、本地文件、消息渠道或小应用的真实任务。',
        focus: '让同一任务跨模型、Agent、浏览器、本地文件、消息渠道、定时执行和交互结果持续推进，不必拆到多个产品里。',
        bestFor: '工作经常跨资料、内容、数据、代码、文件和沟通渠道，同时希望工作台开源、可自托管并长期掌控。',
        sourceLabel: '产品文档',
        sourceUrl: 'https://docs.nextclaw.io/zh/guide/introduction',
        featured: true
      },
      {
        product: 'WorkBuddy',
        category: 'AI 办公工作台',
        icon: 'briefcase-business',
        start: '文档、表格、PPT、调研，以及腾讯文档、会议、邮箱等办公服务。',
        focus: '在一套商业产品里规划任务，并交付文档、表格、演示文稿等知识工作成果。',
        bestFor: '想快速使用成品 AI 办公工作台，且工作主要围绕腾讯办公生态。',
        sourceLabel: '官方介绍',
        sourceUrl: 'https://www.codebuddy.cn/docs/workbuddy/Overview'
      },
      {
        product: 'Codex',
        category: '软件工程 Agent',
        icon: 'code-2',
        start: '代码库、Issue、PR、终端或开发环境。',
        focus: '理解、修改、测试、审查并交付软件，支持并行 Agent 工程流程。',
        bestFor: '主要产物是代码，最看重软件工程深度、代码评审和交付效率。',
        sourceLabel: '官方介绍',
        sourceUrl: 'https://openai.com/codex/'
      }
    ],
    proofTitle: '这些工作更适合放进 NextClaw',
    proofDescription: '当一项任务要跨过多个环节、需要使用本机资料，或者不能只停在一次回答时，NextClaw 的价值会更明显。',
    proofs: [
      {
        icon: 'bar-chart-3',
        title: '查资料、算数据，再交付一份报告',
        description: '收集网页、CSV 或表格，清洗和画图，再把结论与原始资料放在一起交付。',
        linkLabel: '查看任务示例',
        href: 'https://docs.nextclaw.io/zh/guide/create-task'
      },
      {
        icon: 'messages-square',
        title: '从微信或飞书接任务，再把结果发回去',
        description: '请求从常用聊天入口进来，在本机继续处理文件或项目，完成后再回到原来的渠道。',
        linkLabel: '消息渠道',
        href: 'https://docs.nextclaw.io/zh/guide/channels'
      },
      {
        icon: 'files',
        title: '直接处理本地文件、代码和 HTML',
        description: '读取或修改文件后，在会话旁查看 Markdown、源码、图表和 HTML 实际页面。',
        linkLabel: '查看任务结果',
        href: 'https://docs.nextclaw.io/zh/guide/results'
      },
      {
        icon: 'app-window',
        title: '给自己做一个能继续使用的小应用',
        description: '把分析结果、仪表盘、表单或重复流程做成会话旁可以直接操作的 Panel App。',
        linkLabel: 'Panel Apps',
        href: 'https://docs.nextclaw.io/zh/guide/panel-apps'
      },
      {
        icon: 'calendar-clock',
        title: '让日报、巡检和提醒按时继续跑',
        description: '先手动跑通一次，再把每日简报、健康检查、提醒或周期汇总交给定时任务。',
        linkLabel: '定时工作',
        href: 'https://docs.nextclaw.io/zh/guide/after-setup'
      },
      {
        icon: 'waypoints',
        title: '不同任务使用更合适的 Agent',
        description: '开发时使用 Codex 或 Claude Code，其他任务选择 Native 或 Hermes，结果仍在 NextClaw 中查看和管理。',
        linkLabel: '运行时文档',
        href: 'https://docs.nextclaw.io/zh/guide/tutorials/claude-codex-hermes'
      }
    ],
    sourceNote: '依据各产品公开资料和 NextClaw 当前可验证能力整理，核对时间为 2026 年 7 月 16 日。产品会持续变化，请以链接页面为准。'
  }
};
