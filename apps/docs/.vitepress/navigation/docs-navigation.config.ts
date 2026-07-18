import { readdirSync, readFileSync } from 'node:fs';
import type { DefaultTheme } from 'vitepress';

export const enNav: DefaultTheme.NavItem[] = [
  { text: 'Start', link: '/en/guide/introduction' },
  { text: 'How It Works', link: '/en/guide/chat' },
  { text: 'Task Guides', link: '/en/tasks/' },
  { text: 'Setup & Reference', link: '/en/guide/install' },
  { text: 'Updates', link: '/en/notes/' },
  { text: 'More', link: '/en/project/' }
];

export const zhNav: DefaultTheme.NavItem[] = [
  { text: '开始', link: '/zh/guide/introduction' },
  { text: '工作方式', link: '/zh/guide/chat' },
  { text: '任务案例', link: '/zh/tasks/' },
  { text: '安装与参考', link: '/zh/guide/install' },
  { text: '更新', link: '/zh/notes/' },
  { text: '更多', link: '/zh/project/' }
];

const enGuideSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'Start with a real task',
    items: [
      { text: 'What is NextClaw?', link: '/en/guide/introduction' },
      { text: 'Install NextClaw', link: '/en/guide/install' },
      { text: 'Quickstart', link: '/en/guide/getting-started' },
      { text: 'Create your first task', link: '/en/guide/create-task' },
      { text: 'Inspect results', link: '/en/guide/results' },
      { text: 'Choose the next step', link: '/en/guide/after-setup' }
    ]
  },
  {
    text: 'How NextClaw works',
    items: [
      { text: 'Tasks and sessions', link: '/en/guide/chat' },
      { text: 'Session workspace', link: '/en/guide/workspace' },
      { text: 'Agents and subtasks', link: '/en/guide/multi-agent' },
      { text: 'Tools and actions', link: '/en/guide/tools' },
      { text: 'Skills and MCP', link: '/en/guide/skills-and-mcp' },
      { text: 'Panel Apps', link: '/en/guide/panel-apps' },
      { text: 'Doc Browser', link: '/en/guide/doc-browser' },
      { text: 'Scheduled tasks', link: '/en/guide/cron' },
      { text: 'Messaging channels', link: '/en/guide/channels' }
    ]
  },
  {
    text: 'Install and configure',
    items: [
      { text: 'Models and providers', link: '/en/guide/model-selection' },
      { text: 'Tutorial overview', link: '/en/guide/tutorials' },
      { text: 'Background and autostart', link: '/en/guide/background-autostart' },
      { text: 'Remote access', link: '/en/guide/remote-access' },
      { text: 'Security and permissions', link: '/en/guide/security-and-permissions' },
      { text: 'Secrets', link: '/en/guide/secrets' }
    ]
  },
  {
    text: 'Product updates',
    items: [{ text: 'What changed in each release', link: '/en/notes/' }]
  },
  {
    text: 'Setup tutorials',
    collapsed: true,
    items: [
      { text: 'Pick a provider path', link: '/en/guide/tutorials/provider-options' },
      { text: 'Docker deployment', link: '/en/guide/tutorials/docker-one-click' },
      { text: 'Qwen Portal setup', link: '/en/guide/tutorials/qwen-portal' },
      { text: 'Local Ollama + Qwen3', link: '/en/guide/tutorials/local-ollama-qwen3' },
      { text: 'Feishu setup', link: '/en/guide/tutorials/feishu' },
      { text: 'MCP Marketplace', link: '/en/guide/tutorials/mcp-marketplace' },
      { text: 'Remote access UI', link: '/en/guide/tutorials/remote-access-ui' },
      { text: 'Skills', link: '/en/guide/tutorials/skills' },
      { text: 'Linux desktop install', link: '/en/guide/tutorials/linux-desktop-deb-apt' },
      { text: 'Claude, Codex, and Hermes', link: '/en/guide/tutorials/claude-codex-hermes' }
    ]
  },
  {
    text: 'Reference',
    collapsed: true,
    items: [
      { text: 'Configuration', link: '/en/guide/configuration' },
      { text: 'Runtime and hosting', link: '/en/guide/runtime-hosting' },
      { text: 'Troubleshooting', link: '/en/guide/troubleshooting' },
      { text: 'Core commands', link: '/en/guide/core-commands' },
      { text: 'Command index', link: '/en/guide/commands' },
      { text: 'Advanced configuration', link: '/en/guide/advanced' },
      { text: 'Resource hub', link: '/en/guide/resources' }
    ]
  }
];

const zhGuideSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '从一个真实任务开始',
    items: [
      { text: 'NextClaw 是什么', link: '/zh/guide/introduction' },
      { text: '安装 NextClaw', link: '/zh/guide/install' },
      { text: '快速开始', link: '/zh/guide/getting-started' },
      { text: '创建第一个任务', link: '/zh/guide/create-task' },
      { text: '查看任务结果', link: '/zh/guide/results' },
      { text: '选择下一步', link: '/zh/guide/after-setup' }
    ]
  },
  {
    text: 'NextClaw 如何工作',
    items: [
      { text: '任务与会话', link: '/zh/guide/chat' },
      { text: '会话工作区', link: '/zh/guide/workspace' },
      { text: 'Agent 与子任务', link: '/zh/guide/multi-agent' },
      { text: '工具与操作', link: '/zh/guide/tools' },
      { text: 'Skills 与 MCP', link: '/zh/guide/skills-and-mcp' },
      { text: 'Panel Apps', link: '/zh/guide/panel-apps' },
      { text: 'Doc Browser', link: '/zh/guide/doc-browser' },
      { text: '定时任务', link: '/zh/guide/cron' },
      { text: '消息渠道', link: '/zh/guide/channels' }
    ]
  },
  {
    text: '安装与配置',
    items: [
      { text: '模型与提供方', link: '/zh/guide/model-selection' },
      { text: '配置教程总览', link: '/zh/guide/tutorials' },
      { text: '后台运行与自启动', link: '/zh/guide/background-autostart' },
      { text: '远程访问', link: '/zh/guide/remote-access' },
      { text: '安全与权限', link: '/zh/guide/security-and-permissions' },
      { text: '密钥管理', link: '/zh/guide/secrets' }
    ]
  },
  {
    text: '产品动态',
    items: [{ text: '查看每个版本的更新', link: '/zh/notes/' }]
  },
  {
    text: '配置教程',
    collapsed: true,
    items: [
      { text: '选择模型接入方式', link: '/zh/guide/tutorials/provider-options' },
      { text: 'Docker 部署', link: '/zh/guide/tutorials/docker-one-click' },
      { text: 'Qwen Portal 配置', link: '/zh/guide/tutorials/qwen-portal' },
      { text: '本地 Ollama + Qwen3', link: '/zh/guide/tutorials/local-ollama-qwen3' },
      { text: '飞书配置', link: '/zh/guide/tutorials/feishu' },
      { text: 'MCP Marketplace', link: '/zh/guide/tutorials/mcp-marketplace' },
      { text: '远程访问 UI', link: '/zh/guide/tutorials/remote-access-ui' },
      { text: 'Skills', link: '/zh/guide/tutorials/skills' },
      { text: 'Linux 桌面安装', link: '/zh/guide/tutorials/linux-desktop-deb-apt' },
      { text: 'Claude、Codex 与 Hermes', link: '/zh/guide/tutorials/claude-codex-hermes' }
    ]
  },
  {
    text: '参考资料',
    collapsed: true,
    items: [
      { text: '配置手册', link: '/zh/guide/configuration' },
      { text: '运行与托管', link: '/zh/guide/runtime-hosting' },
      { text: '故障排查', link: '/zh/guide/troubleshooting' },
      { text: '核心命令', link: '/zh/guide/core-commands' },
      { text: '命令索引', link: '/zh/guide/commands' },
      { text: '进阶配置', link: '/zh/guide/advanced' },
      { text: '生态资源', link: '/zh/guide/resources' }
    ]
  }
];

const enTasksSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'Work with information',
    items: [
      { text: 'Task guide overview', link: '/en/tasks/' },
      { text: 'Analyze data and build charts', link: '/en/tasks/data-analysis' },
      { text: 'Organize a folder of files', link: '/en/tasks/file-processing' },
      { text: 'Research with cited sources', link: '/en/tasks/research-writing' },
      { text: 'Draft an article or report', link: '/en/tasks/writing' },
      { text: 'Analyze customer feedback', link: '/en/tasks/feedback-analysis' }
    ]
  },
  {
    text: 'Create and run',
    items: [
      { text: 'Generate an image file', link: '/en/tasks/image-creation' },
      { text: 'Build a local app', link: '/en/tasks/build-local-app' },
      { text: 'Inspect and modify a codebase', link: '/en/tasks/code-project' },
      { text: 'Send a scheduled brief', link: '/en/tasks/scheduled-brief' },
      { text: 'Handle requests from chat apps', link: '/en/tasks/chat-channel-work' }
    ]
  },
  {
    text: 'Product updates',
    items: [{ text: 'What changed in each release', link: '/en/notes/' }]
  }
];

const zhTasksSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '处理信息与资料',
    items: [
      { text: '任务案例总览', link: '/zh/tasks/' },
      { text: '分析数据并生成图表', link: '/zh/tasks/data-analysis' },
      { text: '整理一批本地文件', link: '/zh/tasks/file-processing' },
      { text: '调研多个来源并标注出处', link: '/zh/tasks/research-writing' },
      { text: '根据资料写文章或报告', link: '/zh/tasks/writing' },
      { text: '汇总用户反馈并排优先级', link: '/zh/tasks/feedback-analysis' }
    ]
  },
  {
    text: '创建与持续运行',
    items: [
      { text: '生成图片并保留本地文件', link: '/zh/tasks/image-creation' },
      { text: '开发一个本地小应用', link: '/zh/tasks/build-local-app' },
      { text: '检查并修改一个代码项目', link: '/zh/tasks/code-project' },
      { text: '定时生成并发送简报', link: '/zh/tasks/scheduled-brief' },
      { text: '从微信或飞书接收任务', link: '/zh/tasks/chat-channel-work' }
    ]
  },
  {
    text: '产品动态',
    items: [{ text: '查看每个版本的更新', link: '/zh/notes/' }]
  }
];

const enProjectSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'Project',
    items: [
      { text: 'Overview', link: '/en/project/' },
      { text: 'Project Pulse', link: '/en/project/project-pulse' },
      { text: 'Vision', link: '/en/project/vision' },
      { text: 'Roadmap', link: '/en/project/roadmap' },
      { text: 'Release notes', link: '/en/project/release-notes' },
      { text: 'Community', link: '/en/project/community' }
    ]
  }
];

const zhProjectSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '项目',
    items: [
      { text: '总览', link: '/zh/project/' },
      { text: 'Project Pulse', link: '/zh/project/project-pulse' },
      { text: '愿景', link: '/zh/project/vision' },
      { text: '路线图', link: '/zh/project/roadmap' },
      { text: '更新笔记', link: '/zh/project/release-notes' },
      { text: '社区', link: '/zh/project/community' }
    ]
  }
];

const createNotesSidebar = (
  locale: 'en' | 'zh',
  text: string,
  allUpdatesText: string
): DefaultTheme.SidebarItem[] => {
  const notesDirectory = new URL(`../../${locale}/notes/`, import.meta.url);
  const noteItems = readdirSync(notesDirectory)
    .filter((fileName) => fileName.endsWith('.md') && fileName !== 'index.md')
    .sort((left, right) => right.localeCompare(left))
    .map((fileName) => {
      const source = readFileSync(new URL(fileName, notesDirectory), 'utf8');
      const title = source.match(/^title:\s*(.+)$/m)?.[1]?.trim();
      if (!title) {
        throw new Error(`Missing frontmatter title in ${locale}/notes/${fileName}`);
      }
      return {
        text: title.replace(/^\d{4}-\d{2}-\d{2}\s*·\s*/, ''),
        link: `/${locale}/notes/${fileName.slice(0, -3)}`
      };
    });

  return [{ text, items: [{ text: allUpdatesText, link: `/${locale}/notes/` }, ...noteItems] }];
};

const enNotesSidebar = createNotesSidebar('en', 'Product Updates', 'All updates');
const zhNotesSidebar = createNotesSidebar('zh', '产品更新', '全部更新');

const enBlogSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: 'Blog',
    items: [
      { text: 'Overview', link: '/en/blog/' },
      { text: 'Access NextClaw from anywhere', link: '/en/blog/2026-07-18-remote-access-your-nextclaw' },
      { text: 'Self-hosting and mini apps', link: '/en/blog/2026-07-16-self-hosted-codex-workbuddy-panel-apps' },
      { text: 'Real-time agent progress', link: '/en/blog/2026-06-03-real-time-agent-progress' },
      { text: 'Why project-aware sessions matter', link: '/en/blog/2026-04-03-why-project-aware-sessions-matter' }
    ]
  }
];

const zhBlogSidebar: DefaultTheme.SidebarItem[] = [
  {
    text: '博客',
    items: [
      { text: '总览', link: '/zh/blog/' },
      { text: '远程访问你的 NextClaw', link: '/zh/blog/2026-07-18-remote-access-your-nextclaw' },
      { text: '自部署与小程序系统', link: '/zh/blog/2026-07-16-self-hosted-codex-workbuddy-panel-apps' },
      { text: '实时 Agent 进展', link: '/zh/blog/2026-06-03-real-time-agent-progress' },
      { text: '为什么项目感知会话更重要', link: '/zh/blog/2026-04-03-why-project-aware-sessions-matter' }
    ]
  }
];

export const enSidebar = {
  '/en/guide/': enGuideSidebar,
  '/en/tasks/': enTasksSidebar,
  '/en/project/': enProjectSidebar,
  '/en/notes/': enNotesSidebar,
  '/en/blog/': enBlogSidebar
} satisfies DefaultTheme.SidebarMulti;

export const zhSidebar = {
  '/zh/guide/': zhGuideSidebar,
  '/zh/tasks/': zhTasksSidebar,
  '/zh/project/': zhProjectSidebar,
  '/zh/notes/': zhNotesSidebar,
  '/zh/blog/': zhBlogSidebar
} satisfies DefaultTheme.SidebarMulti;
