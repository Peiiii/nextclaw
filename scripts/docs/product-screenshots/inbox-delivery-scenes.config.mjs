import { ok } from "../product-screenshot-response.utils.mjs";

const createdAt = "2026-08-06T08:30:00.000Z";
const deliveryId = "screenshot-project-brief";

const deliveryProfiles = {
  en: {
    title: "Project Brief · 3 Decisions for Today",
    summary: "AI reviewed the project and delivered the decisions that need your attention.",
    content: `## Today's priorities

AI reviewed the project status and collected the three decisions that matter most:

- **Release:** Builds and core flows are verified, so the release can move into a limited rollout.
- **User feedback:** Important results are scattered across tasks and hard to follow up; bring them into one inbox.
- **Risk:** The desktop update still needs one rollback rehearsal before the rollout expands.

## Recommended order

1. Confirm the rollout group and success signals.
2. Bring important results into one inbox.
3. Complete the rollback rehearsal before expanding access.

> I can turn any item into an action plan when you are ready.`,
    outputSuffix: "en",
  },
  zh: {
    title: "项目晨报｜今天最值得处理的 3 件事",
    summary: "AI 已检查项目状态，并把需要你决策的事项送到收件箱。",
    content: `## 今日重点

AI 已检查项目状态，并整理出最需要你决策的三件事：

- **版本发布**：构建与核心流程已验证，可以进入小范围灰度。
- **用户反馈**：重要结果散落在不同任务里，后续很难继续处理，建议集中到一个收件箱。
- **风险提醒**：桌面端更新仍需完成一次回滚演练，再扩大范围。

## 建议顺序

1. 确认灰度范围和观察指标。
2. 把关键结果纳入统一收件箱。
3. 完成回滚演练后再扩大范围。

> 需要时，我可以直接把其中一项拆成执行清单。`,
    outputSuffix: "cn",
  },
};

function createDelivery(profile, presentedAt = null) {
  return {
    id: deliveryId,
    title: profile.title,
    summary: profile.summary,
    content: profile.content,
    contentType: "markdown",
    source: {
      kind: "agent",
      agentId: "main",
      sessionId: null,
      toolCallId: "screenshot-delivery",
      filePath: null,
    },
    createdAt,
    updatedAt: presentedAt ?? createdAt,
    presentedAt,
    readAt: null,
    archivedAt: null,
    conversationSessionId: null,
  };
}

function profileForScene(sceneId) {
  return sceneId.endsWith("-en") ? deliveryProfiles.en : deliveryProfiles.zh;
}

export function resolveInboxDeliveryScreenshotMock({ method, pathname, sceneId }) {
  if (!sceneId.startsWith("inbox-delivery-")) {
    return null;
  }
  const profile = profileForScene(sceneId);
  const itemPath = `/api/inbox/deliveries/${deliveryId}`;
  if (method === "GET" && pathname === "/api/inbox/deliveries") {
    return ok({
      deliveries: [createDelivery(profile)],
      total: 1,
      unreadCount: 1,
      unpresentedCount: 1,
    });
  }
  if (method === "GET" && pathname === itemPath) {
    return ok(createDelivery(profile));
  }
  if (method === "PATCH" && pathname === itemPath) {
    return ok(createDelivery(profile, "2026-08-06T08:30:01.000Z"));
  }
  return null;
}

export function createInboxDeliveryScreenshotScenes() {
  return Object.entries(deliveryProfiles).map(([language, profile]) => ({
    id: `inbox-delivery-${language}`,
    route: "/chat",
    language,
    waitText: profile.title,
    afterLoad: async ({ page }) => {
      await page.getByRole("dialog").waitFor({ state: "visible", timeout: 20_000 });
      await page.waitForTimeout(500);
    },
    outputs: [
      `images/screenshots/nextclaw-ai-delivery-inbox-${profile.outputSuffix}.png`,
      `apps/landing/public/nextclaw-ai-delivery-inbox-${profile.outputSuffix}.png`,
    ],
  }));
}
