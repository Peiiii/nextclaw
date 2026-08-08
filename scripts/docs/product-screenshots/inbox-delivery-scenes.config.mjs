import { ok } from "../product-screenshot-response.utils.mjs";

const createdAt = "2026-08-06T08:30:00.000Z";
const presentedAt = "2026-08-06T08:31:00.000Z";
const deliveryId = "screenshot-project-brief";

const deliveryProfiles = {
  en: {
    title: "Daily AI & Tech Brief · 2026-08-06",
    htmlTitle: "Daily AI & Tech Brief · 2026-08-06 (HTML)",
    summary: "A daily briefing of AI and technology stories collected by a background Agent.",
    markdownContent: `## Today's priorities

AI reviewed the project status and collected the three decisions that matter most:

- **Release:** Builds and core flows are verified, so the release can move into a limited rollout.
- **User feedback:** Important results are scattered across tasks and hard to follow up; bring them into one inbox.
- **Risk:** The desktop update still needs one rollback rehearsal before the rollout expands.

## Recommended order

1. Confirm the rollout group and success signals.
2. Bring important results into one inbox.
3. Complete the rollback rehearsal before expanding access.

> I can turn any item into an action plan when you are ready.`,
    report: {
      edition: "AGENT BROWSER · LIVE",
      snapshot: "Aug 6 · 08:30 UTC snapshot",
      sources: "Hacker News + GitHub Trending",
      heading: "Daily AI & Tech Brief",
      intro: "A focused scan of today's AI, software, and open-source signals.",
      section: "Hacker News highlights",
      sort: "Ranked by points",
      stories: [
        ["307", "Cloudflare introduces an open platform for agents and apps", "168 comments", "blog.cloudflare.com", "100%"],
        ["289", "New browser automation benchmarks put reliability first", "172 comments", "github.com", "92%"],
        ["243", "Local-first developer tools move toward durable task history", "123 comments", "news.ycombinator.com", "78%"],
      ],
    },
    inboxItems: [
      ["Release readiness · 2 checks remaining", "The rollout can begin after the rollback rehearsal and one update-path check."],
      ["User feedback digest · 7 new signals", "The strongest request is a durable place for AI-delivered work."],
    ],
    labels: { all: "All" },
    outputSuffix: "en",
  },
  zh: {
    title: "每日 AI 与科技简报 · 2026-08-06",
    htmlTitle: "每日 AI 与科技简报 · 2026-08-06（HTML）",
    summary: "后台 Agent 每日整理 AI、科技与开源社区热点。",
    markdownContent: `## 今日重点

AI 已检查项目状态，并整理出最需要你决策的三件事：

- **版本发布**：构建与核心流程已验证，可以进入小范围灰度。
- **用户反馈**：重要结果散落在不同任务里，后续很难继续处理，建议集中到一个收件箱。
- **风险提醒**：桌面端更新仍需完成一次回滚演练，再扩大范围。

## 建议顺序

1. 确认灰度范围和观察指标。
2. 把关键结果纳入统一收件箱。
3. 完成回滚演练后再扩大范围。

> 需要时，我可以直接把其中一项拆成执行清单。`,
    report: {
      edition: "AGENT BROWSER · 实时",
      snapshot: "2026-08-06 16:30 CST 快照",
      sources: "Hacker News + GitHub Trending",
      heading: "每日 AI 与科技简报",
      intro: "快速浏览今天值得关注的 AI、软件与开源社区动态。",
      section: "Hacker News 科技热点",
      sort: "按热度排序 · points",
      stories: [
        ["307", "Cloudflare 推出面向 Agent 与应用的开放平台", "168 条评论", "blog.cloudflare.com", "100%"],
        ["289", "新的浏览器自动化基准把可靠性放在首位", "172 条评论", "github.com", "92%"],
        ["243", "本地优先的开发工具开始提供持久任务历史", "123 条评论", "news.ycombinator.com", "78%"],
      ],
    },
    inboxItems: [
      ["发布准备度｜还剩 2 项检查", "完成回滚演练和更新链路检查后，即可进入小范围灰度。"],
      ["用户反馈摘要｜新增 7 条信号", "最集中的需求，是为 AI 主动送达的结果提供一个长期入口。"],
    ],
    labels: { all: "全部" },
    outputSuffix: "cn",
  },
};

function createHtmlReport(profile) {
  const storyCards = profile.report.stories.map(([score, title, comments, domain, width]) => `
    <article class="story">
      <strong class="score">${score}<small>pts</small></strong>
      <div class="story-copy">
        <h2>${title}</h2>
        <p>${comments} · <em>${domain}</em></p>
        <span class="meter"><i style="width: ${width}"></i></span>
      </div>
    </article>`).join("");
  return `<!doctype html>
<html lang="${profile.outputSuffix === "cn" ? "zh-CN" : "en"}">
<head>
  <meta charset="utf-8">
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    html, body { min-height: 100%; margin: 0; background: #070b14; color: #e7eefb; }
    body { padding: 0; }
    .report { min-height: 100vh; padding: 30px 36px; background: radial-gradient(circle at 85% 0%, rgba(49, 103, 255, .14), transparent 34%), linear-gradient(180deg, #090e1a, #060a12); }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
    .pill { border: 1px solid #263249; border-radius: 999px; padding: 6px 11px; color: #98a7c2; font-size: 11px; letter-spacing: .03em; }
    .pill.live { border-color: #087d92; background: rgba(15, 169, 190, .12); color: #4ce0ed; font-weight: 700; }
    h1 { margin: 0; font-size: 34px; line-height: 1.15; letter-spacing: -.03em; }
    h1 em { color: #38bdf8; font-style: normal; }
    .intro { margin: 10px 0 24px; color: #93a2bd; font-size: 14px; }
    .section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .section-head h2 { margin: 0; font-size: 17px; }
    .section-head span { color: #65748f; font-size: 11px; }
    .index { display: inline-flex; margin-right: 10px; border: 1px solid #087d92; border-radius: 6px; padding: 4px 7px; color: #39d4e8; font: 700 10px ui-monospace, monospace; }
    .stories { display: grid; gap: 10px; }
    .story { display: flex; gap: 14px; padding: 13px 15px; border: 1px solid #263249; border-radius: 14px; background: rgba(17, 24, 39, .72); }
    .score { display: flex; width: 58px; flex: 0 0 58px; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #0b697d; border-radius: 10px; color: #35c9e8; font-size: 22px; line-height: 1; }
    .score small { margin-top: 5px; color: #70809a; font-size: 9px; letter-spacing: .08em; }
    .story-copy { min-width: 0; flex: 1; }
    .story-copy h2 { margin: 1px 0 5px; font-size: 14px; line-height: 1.4; }
    .story-copy p { margin: 0; color: #8090aa; font-size: 11px; }
    .story-copy em { color: #a78bfa; font-style: normal; }
    .meter { display: block; height: 3px; margin-top: 9px; overflow: hidden; border-radius: 999px; background: #1c2535; }
    .meter i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #25d3e8, #3b82f6); }
    @media (max-width: 680px) { .report { padding: 22px; } h1 { font-size: 28px; } .section-head span { display: none; } }
  </style>
</head>
<body>
  <main class="report">
    <div class="meta">
      <span class="pill live">● ${profile.report.edition}</span>
      <span class="pill">${profile.report.snapshot}</span>
      <span class="pill">${profile.report.sources}</span>
    </div>
    <h1>NextClaw <em>${profile.report.heading}</em></h1>
    <p class="intro">${profile.report.intro}</p>
    <header class="section-head">
      <h2><span class="index">01</span>${profile.report.section}</h2>
      <span>${profile.report.sort}</span>
    </header>
    <section class="stories">${storyCards}</section>
  </main>
</body>
</html>`;
}

function isInboxPageScene(sceneId) {
  return sceneId.startsWith("inbox-page-");
}

function isHtmlScene(sceneId) {
  return sceneId.startsWith("inbox-html-delivery-") || isInboxPageScene(sceneId);
}

function isInboxScene(sceneId) {
  return ["inbox-delivery-", "inbox-html-delivery-", "inbox-page-"]
    .some((prefix) => sceneId.startsWith(prefix));
}

function createDelivery(profile, sceneId, overrides = {}) {
  const html = isHtmlScene(sceneId);
  const page = isInboxPageScene(sceneId);
  return {
    id: overrides.id ?? deliveryId,
    title: overrides.title ?? (html ? profile.htmlTitle : profile.title),
    summary: overrides.summary ?? profile.summary,
    content: overrides.content ?? (html ? createHtmlReport(profile) : profile.markdownContent),
    contentType: overrides.contentType ?? (html ? "html" : "markdown"),
    source: {
      kind: "agent",
      agentId: "main",
      sessionId: null,
      toolCallId: "screenshot-delivery",
      filePath: null,
    },
    createdAt: overrides.createdAt ?? createdAt,
    updatedAt: overrides.updatedAt ?? (page ? presentedAt : createdAt),
    presentedAt: overrides.presentedAt ?? (page ? presentedAt : null),
    readAt: overrides.readAt === undefined ? (page ? presentedAt : null) : overrides.readAt,
    archivedAt: null,
    conversationSessionId: null,
  };
}

function createInboxPageDeliveries(profile, sceneId) {
  const primary = createDelivery(profile, sceneId);
  const additional = profile.inboxItems.map(([title, summary], index) => createDelivery(
    profile,
    sceneId,
    {
      id: `screenshot-inbox-item-${index + 1}`,
      title,
      summary,
      content: `## ${title}\n\n${summary}`,
      contentType: "markdown",
      createdAt: `2026-08-06T0${7 - index}:30:00.000Z`,
      presentedAt,
      readAt: null,
      updatedAt: presentedAt,
    },
  ));
  return [primary, ...additional];
}

function profileForScene(sceneId) {
  return sceneId.endsWith("-en") ? deliveryProfiles.en : deliveryProfiles.zh;
}

export function resolveInboxDeliveryScreenshotMock({ method, pathname, sceneId }) {
  if (!isInboxScene(sceneId)) {
    return null;
  }
  const profile = profileForScene(sceneId);
  const itemPath = `/api/inbox/deliveries/${deliveryId}`;
  if (method === "GET" && pathname === "/api/inbox/deliveries") {
    const deliveries = isInboxPageScene(sceneId)
      ? createInboxPageDeliveries(profile, sceneId)
      : [createDelivery(profile, sceneId)];
    return ok({
      deliveries,
      total: deliveries.length,
      unreadCount: deliveries.filter(({ readAt }) => !readAt).length,
      unpresentedCount: deliveries.filter(({ presentedAt: value }) => !value).length,
    });
  }
  if (method === "GET" && pathname === itemPath) {
    return ok(createDelivery(profile, sceneId));
  }
  if (method === "PATCH" && pathname === itemPath) {
    return ok(createDelivery(profile, sceneId, { presentedAt, updatedAt: presentedAt }));
  }
  return null;
}

function createReaderScene(language, profile, html) {
  const kind = html ? "inbox-html-delivery" : "inbox-delivery";
  const asset = html ? "nextclaw-ai-delivery-html" : "nextclaw-ai-delivery-inbox";
  const title = html ? profile.htmlTitle : profile.title;
  return {
    id: `${kind}-${language}`,
    route: "/chat",
    language,
    waitText: title,
    afterLoad: async ({ page }) => {
      await page.getByRole("dialog").waitFor({ state: "visible", timeout: 20_000 });
      if (html) {
        await page.locator("iframe").waitFor({ state: "visible", timeout: 20_000 });
      }
      await page.waitForTimeout(500);
    },
    outputs: [
      `images/screenshots/${asset}-${profile.outputSuffix}.png`,
      `apps/landing/public/${asset}-${profile.outputSuffix}.png`,
    ],
  };
}

function createInboxPageScene(language, profile) {
  return {
    id: `inbox-page-${language}`,
    route: `/inbox/${deliveryId}`,
    language,
    waitText: profile.htmlTitle,
    afterLoad: async ({ page }) => {
      await page.getByRole("button", { name: profile.labels.all, exact: true }).click();
      await page.locator("iframe").waitFor({ state: "visible", timeout: 20_000 });
      await page.waitForTimeout(500);
    },
    outputs: [
      `images/screenshots/nextclaw-inbox-page-${profile.outputSuffix}.png`,
      `apps/landing/public/nextclaw-inbox-page-${profile.outputSuffix}.png`,
    ],
  };
}

export function createInboxDeliveryScreenshotScenes() {
  return Object.entries(deliveryProfiles).flatMap(([language, profile]) => [
    createReaderScene(language, profile, false),
    createReaderScene(language, profile, true),
    createInboxPageScene(language, profile),
  ]);
}
