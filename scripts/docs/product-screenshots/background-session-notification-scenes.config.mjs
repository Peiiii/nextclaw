const notificationProfiles = {
  en: {
    title: "Daily AI & Tech Brief",
    description: "Today's report is ready with the stories and signals worth reviewing.",
    ariaLabel: "Open completed background session: Daily AI & Tech Brief",
    dismissLabel: "Dismiss notification",
    waitText: "What would you like to get done?",
    outputSuffix: "en",
  },
  zh: {
    title: "每日 AI 与科技简报",
    description: "今天的热点已经整理好，可以查看值得关注的新闻与信号。",
    ariaLabel: "打开已完成的后台会话：每日 AI 与科技简报",
    dismissLabel: "关闭通知",
    waitText: "今天想完成什么？",
    outputSuffix: "cn",
  },
};

async function showBackgroundSessionNotification(page, profile) {
  await page.evaluate(async (notification) => {
    const { getAppPresenter } = await import("/src/app/presenters/app.presenter.ts");
    getAppPresenter().notificationManager.show({
      id: "screenshot-background-session-complete",
      title: notification.title,
      description: notification.description,
      href: "/chat/screenshot-background-session",
      ariaLabel: notification.ariaLabel,
      dismissLabel: notification.dismissLabel,
      durationMs: 60_000,
    });
  }, profile);
  await page.getByRole("link", { name: profile.ariaLabel }).waitFor({
    state: "visible",
    timeout: 20_000,
  });
  await page.getByRole("button", { name: profile.dismissLabel }).waitFor({
    state: "visible",
    timeout: 20_000,
  });
}

export function createBackgroundSessionNotificationScreenshotScenes() {
  return Object.entries(notificationProfiles).map(([language, profile]) => ({
    id: `background-session-notification-${language}`,
    route: "/chat",
    language,
    waitText: profile.waitText,
    afterLoad: async ({ page }) => showBackgroundSessionNotification(page, profile),
    outputs: [
      `images/screenshots/nextclaw-background-session-notification-${profile.outputSuffix}.png`,
      `apps/landing/public/nextclaw-background-session-notification-${profile.outputSuffix}.png`,
    ],
  }));
}
