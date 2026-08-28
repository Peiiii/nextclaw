import { readdirSync, readFileSync } from 'node:fs';
import type { DefaultTheme } from 'vitepress';

type Locale = 'en' | 'zh';
type Sidebar = DefaultTheme.SidebarItem[];

interface LocaleSections {
  start: Sidebar;
  usage: Sidebar;
  tasks: Sidebar;
  settings: Sidebar;
  developers: Sidebar;
  about: Sidebar;
}

export const enNav: DefaultTheme.NavItem[] = [
  { text: 'Start', link: '/en/' },
  { text: 'Using NextClaw', link: '/en/guide/chat' },
  { text: 'Task Guides', link: '/en/tasks/' },
  { text: 'Settings & Help', link: '/en/guide/model-selection' },
  { text: 'Developers', link: '/en/developers/' },
  { text: 'About NextClaw', link: '/en/project/' }
];

export const zhNav: DefaultTheme.NavItem[] = [
  { text: '开始', link: '/zh/' },
  { text: '使用指南', link: '/zh/guide/chat' },
  { text: '使用案例', link: '/zh/tasks/' },
  { text: '设置与帮助', link: '/zh/guide/model-selection' },
  { text: '开发者', link: '/zh/developers/' },
  { text: '关于 NextClaw', link: '/zh/project/' }
];

const readMarkdownTitle = (locale: Locale, directory: 'blog' | 'notes', fileName: string): string => {
  const source = readFileSync(new URL(`../../${locale}/${directory}/${fileName}`, import.meta.url), 'utf8');
  const title = source.match(/^title:\s*(.+)$/m)?.[1]?.trim();
  if (!title) {
    throw new Error(`Missing frontmatter title in ${locale}/${directory}/${fileName}`);
  }
  return title.replace(/^(["'])(.*)\1$/, '$2');
};

const createDatedDirectoryItems = (
  locale: Locale,
  directory: 'blog' | 'notes',
  transformTitle: (title: string) => string
): DefaultTheme.SidebarItem[] => {
  const sourceDirectory = new URL(`../../${locale}/${directory}/`, import.meta.url);
  return readdirSync(sourceDirectory)
    .filter((fileName) => fileName.endsWith('.md') && fileName !== 'index.md')
    .sort((left, right) => right.localeCompare(left))
    .map((fileName) => ({
      text: transformTitle(readMarkdownTitle(locale, directory, fileName)),
      link: `/${locale}/${directory}/${fileName.slice(0, -3)}`
    }));
};

const createUpdateYearGroups = (locale: Locale): DefaultTheme.SidebarItem[] => {
  const items = createDatedDirectoryItems(locale, 'notes', (title) => title);
  const groups = new Map<string, DefaultTheme.SidebarItem[]>();

  for (const item of items) {
    const year = item.text.match(/^(\d{4})-/)?.[1];
    if (!year) {
      throw new Error(`Product update title must start with a year: ${item.text}`);
    }
    const yearItems = groups.get(year) ?? [];
    yearItems.push({ ...item, text: item.text.replace(`${year}-`, '') });
    groups.set(year, yearItems);
  }

  return [...groups.entries()].map(([year, yearItems]) => ({
    text: year,
    collapsed: true,
    items: yearItems
  }));
};

const enSections: LocaleSections = {
    start: [
      {
        text: 'Start',
        items: [
          { text: 'Documentation home', link: '/en/' },
          { text: 'What is NextClaw?', link: '/en/guide/introduction' },
          { text: 'Choose an installation path', link: '/en/guide/install' },
          { text: 'Quickstart', link: '/en/guide/getting-started' },
          { text: 'Create your first task', link: '/en/guide/create-task' },
          { text: 'Inspect task results', link: '/en/guide/results' },
          { text: 'Background results and delivery', link: '/en/guide/background-results' },
          { text: 'After your first task', link: '/en/guide/after-setup' }
        ]
      }
    ],
    usage: [
      {
        text: 'Tasks, sessions, and agents',
        items: [
          { text: 'Tasks and sessions', link: '/en/guide/chat' },
          { text: 'Session management', link: '/en/guide/sessions' },
          { text: 'Session workspace', link: '/en/guide/workspace' },
          { text: 'Agents and subtasks', link: '/en/guide/multi-agent' },
          { text: 'Tools and actions', link: '/en/guide/tools' },
          { text: 'Keep an agent watching', link: '/en/guide/agent-observation' }
        ]
      },
      {
        text: 'Apps and results',
        items: [
          { text: 'Skills and MCP', link: '/en/guide/skills-and-mcp' },
          { text: 'Visualizations', link: '/en/guide/visualizations' },
          { text: 'Panel Apps', link: '/en/guide/panel-apps' },
          { text: 'Doc Browser', link: '/en/guide/doc-browser' },
          {
            text: 'Service Apps',
            items: [
              { text: 'Overview', link: '/en/guide/service-apps' },
              { text: 'Use Service Apps', link: '/en/guide/service-apps-usage' },
              { text: 'Permissions and data', link: '/en/guide/service-app-permissions-data' }
            ]
          }
        ]
      },
      {
        text: 'Automation and connections',
        items: [
          { text: 'Scheduled tasks', link: '/en/guide/cron' },
          { text: 'Messaging channels', link: '/en/guide/channels' },
          { text: 'Remote access', link: '/en/guide/remote-access' }
        ]
      }
    ],
    tasks: [
      { text: 'Task guides', items: [{ text: 'Task guide overview', link: '/en/tasks/' }] },
      {
        text: 'Work with information',
        items: [
          { text: 'Analyze data and build charts', link: '/en/tasks/data-analysis' },
          { text: 'Organize a folder of files', link: '/en/tasks/file-processing' },
          { text: 'Research with cited sources', link: '/en/tasks/research-writing' },
          { text: 'Draft an article or report', link: '/en/tasks/writing' },
          { text: 'Analyze customer feedback', link: '/en/tasks/feedback-analysis' }
        ]
      },
      {
        text: 'Create and keep running',
        items: [
          { text: 'Generate an image file', link: '/en/tasks/image-creation' },
          { text: 'Build a local app', link: '/en/tasks/build-local-app' },
          { text: 'Inspect and modify a codebase', link: '/en/tasks/code-project' },
          { text: 'Send a scheduled brief', link: '/en/tasks/scheduled-brief' },
          { text: 'Handle requests from chat apps', link: '/en/tasks/chat-channel-work' }
        ]
      }
    ],
    settings: [
      {
        text: 'Set up NextClaw',
        items: [
          { text: 'Models and providers', link: '/en/guide/model-selection' },
          { text: 'Background and autostart', link: '/en/guide/background-autostart' },
          { text: 'Security and permissions', link: '/en/guide/security-and-permissions' },
          { text: 'Secrets', link: '/en/guide/secrets' }
        ]
      },
      {
        text: 'Setup tutorials',
        items: [
          { text: 'Tutorial overview', link: '/en/guide/tutorials' },
          { text: 'Choose a provider path', link: '/en/guide/tutorials/provider-options' },
          { text: 'Docker deployment', link: '/en/guide/tutorials/docker-one-click' },
          { text: 'Qwen Portal setup', link: '/en/guide/tutorials/qwen-portal' },
          { text: 'Local Ollama + Qwen3', link: '/en/guide/tutorials/local-ollama-qwen3' },
          { text: 'Feishu setup', link: '/en/guide/tutorials/feishu' },
          { text: 'MCP tutorial', link: '/en/guide/tutorials/mcp-marketplace' },
          { text: 'Remote access UI', link: '/en/guide/tutorials/remote-access-ui' },
          { text: 'Skills tutorial', link: '/en/guide/tutorials/skills' },
          { text: 'Linux desktop install', link: '/en/guide/tutorials/linux-desktop-deb-apt' },
          { text: 'Claude Code, Codex, and Hermes', link: '/en/guide/tutorials/claude-codex-hermes' }
        ]
      },
      {
        text: 'Reference and troubleshooting',
        items: [
          { text: 'Configuration reference', link: '/en/guide/configuration' },
          { text: 'Runtime and hosting', link: '/en/guide/runtime-hosting' },
          { text: 'Runtime resource usage', link: '/en/guide/resource-usage' },
          { text: 'Troubleshooting', link: '/en/guide/troubleshooting' },
          { text: 'Core commands', link: '/en/guide/core-commands' },
          { text: 'CLI capability map', link: '/en/guide/commands' },
          { text: 'Advanced configuration', link: '/en/guide/advanced' }
        ]
      }
    ],
    developers: [
      { text: 'Developers', items: [{ text: 'Overview', link: '/en/developers/' }] },
      {
        text: 'NextClaw Harness SDK',
        items: [
          { text: 'Harness API', link: '/en/developers/harness' },
          { text: 'Platform capabilities', link: '/en/developers/platform-capabilities' },
          { text: 'nextclaw exec', link: '/en/developers/exec' },
          { text: 'Examples', link: '/en/developers/examples' }
        ]
      },
      {
        text: 'Portable Runtime',
        items: [
          { text: 'Overview', link: '/en/developers/portable-runtime' },
          { text: 'Runtime model and capabilities', link: '/en/developers/portable-runtime-contracts' },
          { text: 'Develop WASM Service Apps', link: '/en/developers/portable-service-apps' }
        ]
      }
    ],
    about: [
      {
        text: 'Project',
        items: [
          { text: 'Overview', link: '/en/project/' },
          { text: 'Project Pulse', link: '/en/project/project-pulse' },
          { text: 'Vision', link: '/en/project/vision' },
          { text: 'Roadmap', link: '/en/project/roadmap' },
          { text: 'Community', link: '/en/project/community' }
        ]
      },
      {
        text: 'Blog',
        collapsed: true,
        items: [
          { text: 'Overview', link: '/en/blog/' },
          ...createDatedDirectoryItems('en', 'blog', (title) =>
            title.replace(/^\d{4}-\d{2}-\d{2}\s*·\s*/, '')
          )
        ]
      },
      { text: 'Ecosystem', items: [{ text: 'Ecosystem resources', link: '/en/guide/resources' }] },
      {
        text: 'Product updates',
        collapsed: true,
        items: [
          { text: 'About release notes', link: '/en/project/release-notes' },
          { text: 'All product updates', link: '/en/notes/' },
          ...createUpdateYearGroups('en')
        ]
      }
  ]
};

const zhSections: LocaleSections = {
    start: [
      {
        text: '开始',
        items: [
          { text: '文档首页', link: '/zh/' },
          { text: 'NextClaw 是什么', link: '/zh/guide/introduction' },
          { text: '选择安装方式', link: '/zh/guide/install' },
          { text: '快速开始', link: '/zh/guide/getting-started' },
          { text: '创建第一个任务', link: '/zh/guide/create-task' },
          { text: '查看任务结果', link: '/zh/guide/results' },
          { text: '后台结果与主动送达', link: '/zh/guide/background-results' },
          { text: '完成第一个任务之后', link: '/zh/guide/after-setup' }
        ]
      }
    ],
    usage: [
      {
        text: '任务、会话与 Agent',
        items: [
          { text: '任务与会话', link: '/zh/guide/chat' },
          { text: '会话管理', link: '/zh/guide/sessions' },
          { text: '会话工作区', link: '/zh/guide/workspace' },
          { text: 'Agent 与子任务', link: '/zh/guide/multi-agent' },
          { text: '工具与操作', link: '/zh/guide/tools' },
          { text: '让 Agent 持续关注', link: '/zh/guide/agent-observation' }
        ]
      },
      {
        text: '应用与结果',
        items: [
          { text: 'Skills 与 MCP', link: '/zh/guide/skills-and-mcp' },
          { text: '可视化结果', link: '/zh/guide/visualizations' },
          { text: 'Panel Apps', link: '/zh/guide/panel-apps' },
          { text: 'Doc Browser', link: '/zh/guide/doc-browser' },
          {
            text: 'Service Apps',
            items: [
              { text: '概览', link: '/zh/guide/service-apps' },
              { text: '使用 Service Apps', link: '/zh/guide/service-apps-usage' },
              { text: '权限与数据', link: '/zh/guide/service-app-permissions-data' }
            ]
          }
        ]
      },
      {
        text: '自动化与连接',
        items: [
          { text: '定时任务', link: '/zh/guide/cron' },
          { text: '消息渠道', link: '/zh/guide/channels' },
          { text: '远程访问', link: '/zh/guide/remote-access' }
        ]
      }
    ],
    tasks: [
      { text: '使用案例', items: [{ text: '任务案例总览', link: '/zh/tasks/' }] },
      {
        text: '处理信息与资料',
        items: [
          { text: '分析数据并生成图表', link: '/zh/tasks/data-analysis' },
          { text: '整理一批本地文件', link: '/zh/tasks/file-processing' },
          { text: '调研资料并写成文档', link: '/zh/tasks/research-writing' },
          { text: '根据资料写文章或报告', link: '/zh/tasks/writing' },
          { text: '汇总用户反馈并排出问题优先级', link: '/zh/tasks/feedback-analysis' }
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
      }
    ],
    settings: [
      {
        text: '设置 NextClaw',
        items: [
          { text: '模型与提供方', link: '/zh/guide/model-selection' },
          { text: '后台运行与自启动', link: '/zh/guide/background-autostart' },
          { text: '安全与权限', link: '/zh/guide/security-and-permissions' },
          { text: '密钥管理', link: '/zh/guide/secrets' }
        ]
      },
      {
        text: '配置教程',
        items: [
          { text: '教程总览', link: '/zh/guide/tutorials' },
          { text: '先选接入方式', link: '/zh/guide/tutorials/provider-options' },
          { text: 'Docker 部署', link: '/zh/guide/tutorials/docker-one-click' },
          { text: 'Qwen Portal 配置', link: '/zh/guide/tutorials/qwen-portal' },
          { text: '本地 Ollama + Qwen3', link: '/zh/guide/tutorials/local-ollama-qwen3' },
          { text: '飞书配置', link: '/zh/guide/tutorials/feishu' },
          { text: 'MCP 教程', link: '/zh/guide/tutorials/mcp-marketplace' },
          { text: '远程访问 UI 教程', link: '/zh/guide/tutorials/remote-access-ui' },
          { text: 'Skills 教程', link: '/zh/guide/tutorials/skills' },
          { text: 'Linux 桌面安装', link: '/zh/guide/tutorials/linux-desktop-deb-apt' },
          { text: 'Claude Code、Codex 与 Hermes 集成', link: '/zh/guide/tutorials/claude-codex-hermes' }
        ]
      },
      {
        text: '查询与排查',
        items: [
          { text: '配置手册', link: '/zh/guide/configuration' },
          { text: '运行与托管手册', link: '/zh/guide/runtime-hosting' },
          { text: '运行资源与内存基准', link: '/zh/guide/resource-usage' },
          { text: '故障排查', link: '/zh/guide/troubleshooting' },
          { text: '核心命令', link: '/zh/guide/core-commands' },
          { text: 'CLI 能力全景与命令全集', link: '/zh/guide/commands' },
          { text: '进阶配置', link: '/zh/guide/advanced' }
        ]
      }
    ],
    developers: [
      { text: '开发者', items: [{ text: '概览', link: '/zh/developers/' }] },
      {
        text: 'NextClaw Harness SDK',
        items: [
          { text: 'Harness API', link: '/zh/developers/harness' },
          { text: '平台扩展能力', link: '/zh/developers/platform-capabilities' },
          { text: 'nextclaw exec', link: '/zh/developers/exec' },
          { text: '示例', link: '/zh/developers/examples' }
        ]
      },
      {
        text: 'Portable Runtime',
        items: [
          { text: '概览', link: '/zh/developers/portable-runtime' },
          { text: 'Runtime 模型与能力合同', link: '/zh/developers/portable-runtime-contracts' },
          { text: '开发 WASM Service App', link: '/zh/developers/portable-service-apps' }
        ]
      }
    ],
    about: [
      {
        text: '项目',
        items: [
          { text: '项目总览', link: '/zh/project/' },
          { text: 'Project Pulse', link: '/zh/project/project-pulse' },
          { text: '产品愿景', link: '/zh/project/vision' },
          { text: '路线图', link: '/zh/project/roadmap' },
          { text: '社区', link: '/zh/project/community' }
        ]
      },
      {
        text: '博客',
        collapsed: true,
        items: [
          { text: '博客总览', link: '/zh/blog/' },
          ...createDatedDirectoryItems('zh', 'blog', (title) =>
            title.replace(/^\d{4}-\d{2}-\d{2}\s*·\s*/, '')
          )
        ]
      },
      { text: '生态', items: [{ text: '生态资源', link: '/zh/guide/resources' }] },
      {
        text: '产品更新',
        collapsed: true,
        items: [
          { text: '更新笔记说明', link: '/zh/project/release-notes' },
          { text: '全部产品更新', link: '/zh/notes/' },
          ...createUpdateYearGroups('zh')
        ]
      }
  ]
};

const migratedGuidePages = ['guide/project-pulse', 'guide/roadmap', 'guide/vision'];

function collectSidebarLinks(items: Sidebar): string[] {
  const links: string[] = [];
  const visit = (entries: Sidebar): void => {
    for (const entry of entries) {
      if (entry.link) links.push(entry.link);
      if (entry.items) visit(entry.items);
    }
  };
  visit(items);
  return links;
}

const createLocaleSidebar = (locale: Locale, sections: LocaleSections): DefaultTheme.SidebarMulti => {
  const sidebar: DefaultTheme.SidebarMulti = {
    [`/${locale}/tasks/`]: sections.tasks,
    [`/${locale}/developers/`]: sections.developers,
    [`/${locale}/project/`]: sections.about,
    [`/${locale}/notes/`]: sections.about,
    [`/${locale}/blog/`]: sections.about
  };

  for (const items of Object.values(sections)) {
    for (const link of collectSidebarLinks(items)) {
      if (link.startsWith(`/${locale}/guide/`)) {
        sidebar[link] = items;
      }
    }
  }

  for (const path of migratedGuidePages) {
    sidebar[`/${locale}/${path}`] = sections.about;
  }
  sidebar[`/${locale}/`] = sections.start;
  return sidebar;
};

const listMarkdownRoutes = (locale: Locale): string[] => {
  const localeDirectory = new URL(`../../${locale}/`, import.meta.url);
  const routes: string[] = [];

  const walk = (directory: URL, relativeDirectory = ''): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(new URL(`${entry.name}/`, directory), relativePath);
      } else if (entry.name.endsWith('.md')) {
        routes.push(
          entry.name === 'index.md'
            ? `/${locale}/${relativeDirectory ? `${relativeDirectory}/` : ''}`
            : `/${locale}/${relativePath.slice(0, -3)}`
        );
      }
    }
  };

  walk(localeDirectory);
  return routes.sort();
};

const assertCompleteNavigation = (locale: Locale, sections: LocaleSections): void => {
  const sectionEntries = Object.entries(sections) as [keyof LocaleSections, Sidebar][];
  const owners = new Map<string, keyof LocaleSections>();

  for (const [section, items] of sectionEntries) {
    for (const link of collectSidebarLinks(items)) {
      const existingOwner = owners.get(link);
      if (existingOwner) {
        throw new Error(`Duplicate ${locale} navigation owner for ${link}: ${existingOwner} and ${section}`);
      }
      owners.set(link, section);
    }
  }

  const excludedRoutes = new Set(migratedGuidePages.map((path) => `/${locale}/${path}`));
  const expectedRoutes = listMarkdownRoutes(locale).filter((route) => !excludedRoutes.has(route));
  const missingRoutes = expectedRoutes.filter((route) => !owners.has(route));
  const staleLinks = [...owners.keys()].filter((route) => !expectedRoutes.includes(route));

  if (missingRoutes.length || staleLinks.length) {
    throw new Error(
      `Incomplete ${locale} documentation navigation.` +
        ` Missing: ${missingRoutes.join(', ') || 'none'}.` +
        ` Stale: ${staleLinks.join(', ') || 'none'}.`
    );
  }
};

assertCompleteNavigation('en', enSections);
assertCompleteNavigation('zh', zhSections);

export const enSidebar = createLocaleSidebar('en', enSections);
export const zhSidebar = createLocaleSidebar('zh', zhSections);
