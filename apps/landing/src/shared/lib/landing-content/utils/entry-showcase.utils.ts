import type { Locale } from '@/shared/lib/landing-content/landing-content.types';

export function renderEntryShowcase(locale: Locale, docsLink: string): string {
  const zh = locale === 'zh';
  const groups = [
    {
      title: zh ? '安装在哪里' : 'Where to install',
      description: zh ? '选一台设备，让 NextClaw 在那里运行。' : 'Choose a device to run NextClaw.',
      items: [
        { icon: 'monitor', title: zh ? '个人电脑' : 'Your computer', detail: 'macOS · Windows · Linux', note: zh ? '桌面应用，下载安装即可使用；Windows 也提供便携版。' : 'Download the desktop app. A portable edition is also available for Windows.' },
        { icon: 'server', title: zh ? '服务器 / NAS' : 'Server / NAS', detail: 'Docker · npm', note: zh ? '部署在家里的 NAS 或云服务器上，保持在线。' : 'Run on a home NAS or cloud server to keep it online.' },
      ],
      href: `/${locale}/download/`,
      label: zh ? '选择安装方式' : 'Choose an installation',
    },
    {
      title: zh ? '从哪里使用' : 'Where to connect',
      description: zh ? '安装完成后，选择顺手的入口。' : 'Once installed, connect the way that suits you.',
      items: [
        { icon: 'app-window', title: zh ? '桌面应用' : 'Desktop app', detail: zh ? '电脑上直接打开' : 'Open on your computer', note: zh ? '聊天、处理文件、查看成果，都在一个工作台里。' : 'Chat, work with files, and view results in one workspace.' },
        { icon: 'smartphone', title: zh ? '浏览器' : 'Browser', detail: zh ? '电脑 · 手机 · 平板' : 'Computer · Phone · Tablet', note: zh ? '界面适配桌面和移动端。开启远程访问后，也能从其他设备打开。' : 'Layouts adapt to desktop and mobile. Enable remote access to connect from another device.' },
        { icon: 'messages-square', title: zh ? '聊天工具' : 'Messaging apps', detail: zh ? '微信 · 飞书 · QQ · 钉钉等' : 'WeChat · Telegram · Discord · Slack & more', note: zh ? '接入渠道后，在日常聊天工具里交代任务、接收回复。' : 'Connect a channel to send tasks and receive replies in your usual messaging app.' },
      ],
      href: `${docsLink}guide/channels`,
      label: zh ? '查看支持的聊天工具' : 'See messaging integrations',
    },
  ];
  return `<section id="use-anywhere" class="mx-auto w-full max-w-7xl scroll-mt-24 px-6 py-16">
    <span id="mobile" class="scroll-mt-24"></span>
    <div class="mb-10 max-w-3xl">
      <h2 class="mb-4 text-3xl font-bold md:text-5xl">${zh ? '在你习惯的地方，找到你的 AI 搭档。' : 'Your AI partner, wherever you work.'}</h2>
      <p class="text-lg leading-relaxed text-muted-foreground">${zh ? '在电脑、服务器或 NAS 上运行，从桌面、浏览器或聊天工具访问。' : 'Run on your computer, server, or NAS. Connect through the desktop app, a browser, or your messaging tools.'}</p>
    </div>
    <div class="grid gap-6 md:grid-cols-2">${groups.map(group => `<article class="flex min-w-0 flex-col rounded-2xl border border-border bg-background p-6 md:p-8">
      <h3 class="mb-2 text-2xl font-semibold">${group.title}</h3>
      <p class="mb-6 text-sm leading-relaxed text-muted-foreground">${group.description}</p>
      <ul class="flex-1 divide-y divide-border">${group.items.map(item => `<li class="flex gap-4 py-5 first:pt-0">
        <i data-lucide="${item.icon}" class="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true"></i>
        <div>
          <h4 class="font-semibold">${item.title}</h4>
          <p class="mt-1 text-sm font-medium">${item.detail}</p>
          <p class="mt-2 text-sm leading-relaxed text-muted-foreground">${item.note}</p>
        </div>
      </li>`).join('')}</ul>
      <a href="${group.href}" class="mt-6 self-start text-sm font-medium text-primary underline underline-offset-4">${group.label} <span aria-hidden="true">→</span></a>
    </article>`).join('')}</div>
    <p class="mt-5 text-sm leading-relaxed text-muted-foreground">${zh ? '从其他设备访问时，运行 NextClaw 的电脑或服务器需要保持在线。' : 'Keep the computer or server running NextClaw online when connecting from another device.'} <a href="${docsLink}guide/remote-access" class="text-primary underline underline-offset-4">${zh ? '了解远程访问' : 'Learn about remote access'} <span aria-hidden="true">→</span></a></p>
  </section>`;
}
