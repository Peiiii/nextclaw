import type {
  Locale,
  ProactiveDeliveryShowcase,
} from "./landing-content.types";

export const PROACTIVE_DELIVERY_COPY: Record<
  Locale,
  ProactiveDeliveryShowcase
> = {
  en: {
    eyebrow: "Proactive delivery",
    title: "It doesn't just wait for your next prompt.",
    description:
      "Let an Agent prepare a daily brief, recommendation, or report in the background. Important results arrive in a persistent AI Inbox, while a lightweight notice tells you when other work is ready. Read now or continue the conversation later.",
    inboxLabel: "AI Inbox",
    inboxTitle: "Reports arrive ready to read",
    notificationLabel: "Completion notice",
    notificationTitle: "Know when background work finishes",
    guideLabel: "Explore proactive delivery",
    inboxImageSrc: "/nextclaw-island-inbox-workspace-cn.png",
    inboxImageAlt:
      "NextClaw Island theme showing a daily AI and technology briefing delivered to the AI Inbox",
    notificationImageSrc: "/nextclaw-background-session-notification-en.png",
    notificationImageAlt:
      "NextClaw showing a completion notice for a background conversation",
  },
  zh: {
    eyebrow: "主动送达",
    title: "它不只等你提问，也会主动把结果送回来。",
    description:
      "让 Agent 在后台整理日报、推荐或研究报告。重要结果会进入可长期管理的 AI 收件箱，其他后台任务完成时则用轻量提醒及时告诉你。现在阅读，或稍后从报告继续聊。",
    inboxLabel: "AI 收件箱",
    inboxTitle: "日报、推荐和报告，整理好后主动送达",
    notificationLabel: "完成提醒",
    notificationTitle: "后台任务完成时，及时告诉你",
    guideLabel: "了解主动送达",
    inboxImageSrc: "/nextclaw-island-inbox-workspace-cn.png",
    inboxImageAlt: "NextClaw 岛屿主题展示每日 AI 与科技简报主动送达到 AI 收件箱",
    notificationImageSrc: "/nextclaw-background-session-notification-cn.png",
    notificationImageAlt: "NextClaw 显示后台会话完成提醒",
  },
};
