import type { Locale } from '../landing-content.types';
import { renderScreenshot } from '../landing-images.utils';

export function renderEntryShowcase(locale: Locale, docsLink: string): string {
  const zh = locale === 'zh';
  const scenes = [
    {
      icon: 'monitor',
      title: zh ? '电脑上，把事情做完整' : 'Make progress at your desk',
      description: zh ? '从一个问题到一份清晰的报告，在会话里直接查看成果。' : 'Go from a question to a clear report, with the result right in your conversation.',
      image: '/nextclaw-entry-desktop-cn.png',
      alt: zh ? 'NextClaw 真实会话生成的月度阅读报告：15 本书的分类与占比' : 'A real NextClaw reading report with categories and shares for 15 books, shown in Chinese',
      imageClass: 'w-full',
      link: `${docsLink}guide/results`,
    },
    {
      icon: 'messages-square',
      title: zh ? '手机上，找到想聊的事' : 'Find a conversation on your phone',
      description: zh ? '浏览会话标题和最近回复，搜索旧话题，或开始一段新会话。' : 'Browse titles and recent replies, search past topics, or start a new conversation.',
      image: '/screenshots/nextclaw-mobile-chat-list-cn.png',
      alt: zh ? '用户提供的 NextClaw 移动端会话列表真实截图，展示会话摘要、搜索、新建与底部导航' : 'A user-provided screenshot of the NextClaw mobile conversation list, with previews, search, new chat and bottom navigation, shown in Chinese',
      imageClass: 'w-full max-w-[280px]',
      link: `${docsLink}guide/background-results`,
    },
    {
      icon: 'smartphone',
      title: zh ? '手机上，随时接着聊' : 'Follow up on your phone',
      description: zh ? '打开手机浏览器，查看回复，把一个想法变成可执行的清单。' : 'Open your phone browser, read the reply, and turn an idea into an actionable checklist.',
      image: '/nextclaw-entry-mobile-cn.png',
      alt: zh ? 'NextClaw 手机会话中的三小时整理计划，完整回复与输入框可见' : 'A three-hour organizing plan in a real mobile conversation, with the reply and composer visible, shown in Chinese',
      imageClass: 'max-w-[210px]',
      link: `${docsLink}guide/background-results`,
    },
  ];
  return `<section id="use-anywhere" class="mx-auto w-full max-w-7xl scroll-mt-24 px-6 py-16">
    <span id="mobile" class="scroll-mt-24"></span>
    <div class="mb-10 max-w-3xl">
      <h2 class="mb-4 text-3xl font-bold md:text-5xl">${zh ? '在你习惯的地方，找到你的 AI 搭档。' : 'Your AI partner, wherever you work.'}</h2>
      <p class="text-lg leading-relaxed text-muted-foreground">${zh ? '电脑、手机，还有每天都在用的聊天工具。选择顺手的入口，开始一件事。' : 'On your computer, on your phone, or in your everyday messaging app. Choose a familiar place to get started.'}</p>
    </div>
    <div class="grid gap-5 lg:grid-cols-[1.4fr_1fr_1fr]">${scenes.map(scene => `<article class="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-background">
      <div class="px-5 pt-5">
        <i data-lucide="${scene.icon}" class="mb-4 h-5 w-5 text-muted-foreground" aria-hidden="true"></i>
        <h3 class="mb-2 text-xl font-semibold">${scene.title}</h3>
        <p class="text-sm leading-relaxed text-muted-foreground">${scene.description}</p>
      </div>
      <a href="${scene.image}" target="_blank" rel="noopener noreferrer" class="my-5 flex min-h-[320px] flex-1 items-center justify-center bg-muted/30 p-3 lg:min-h-[400px]" aria-label="${scene.alt}">${renderScreenshot(scene.image, scene.alt, { className: `block h-auto object-contain ${scene.imageClass}`, sizes: '(min-width: 1024px) 700px, calc(100vw - 72px)' })}</a>
      <a href="${scene.link}" class="mt-auto px-5 pb-5 pt-4 text-sm font-medium underline underline-offset-4">${zh ? '了解使用方式' : 'See how it works'}</a>
    </article>`).join('')}</div>
    <a href="${docsLink}guide/channels" class="mt-5 flex items-center gap-4 rounded-2xl border border-border px-5 py-4 hover:bg-muted/30">
      <i data-lucide="message-circle" class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true"></i>
      <span class="min-w-0 flex-1"><span class="block font-semibold">${zh ? '也能在微信等聊天工具里使用' : 'Use your everyday messaging tools, too'}</span><span class="mt-1 block text-sm text-muted-foreground">${zh ? '连接聊天渠道，直接交代任务、接收回复。' : 'Connect a messaging channel to give tasks and receive replies.'}</span></span>
      <i data-lucide="arrow-up-right" class="h-4 w-4 shrink-0" aria-hidden="true"></i>
    </a>
  </section>`;
}
