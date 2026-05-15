import {
  BriefcaseBusiness,
  Cpu,
  Globe2,
  MessagesSquare,
  PenLine,
  Sparkles,
  TerminalSquare,
} from "lucide-react";
import type { ComponentType } from "react";

export type MarketplaceShelfLocalizedText = {
  zh: string;
  en: string;
};

export type MarketplaceShelfSceneVisual = {
  scene: string;
  title?: MarketplaceShelfLocalizedText;
  summary?: MarketplaceShelfLocalizedText;
  icon: ComponentType<{ className?: string }>;
  tone: keyof typeof MARKETPLACE_SHELF_TONE_STYLES;
  span: string;
};

export const MARKETPLACE_SHELF_SCENE_VISUALS: MarketplaceShelfSceneVisual[] = [
  {
    scene: "development-debugging",
    title: { zh: "开发与调试", en: "Development" },
    summary: {
      zh: "代码审查、错误定位、架构分析与交付验证。",
      en: "Review, debug, analyze, and verify delivery work.",
    },
    icon: TerminalSquare,
    tone: "dark",
    span: "md:col-span-2",
  },
  {
    scene: "office-collaboration",
    title: { zh: "办公协作", en: "Office Work" },
    summary: {
      zh: "连接文档、日历、会议、邮件和团队通信。",
      en: "Connect docs, calendars, meetings, mail, and teams.",
    },
    icon: BriefcaseBusiness,
    tone: "green",
    span: "md:col-span-2",
  },
  {
    scene: "writing-content",
    title: { zh: "写作与内容", en: "Writing" },
    summary: {
      zh: "把调研、写作、润色和发布组织成连续工作流。",
      en: "Turn research, writing, polishing, and publishing into one flow.",
    },
    icon: PenLine,
    tone: "amber",
    span: "md:col-span-2",
  },
  {
    scene: "browser-automation",
    title: { zh: "浏览器自动化", en: "Browser" },
    summary: {
      zh: "操作网页、捕获动态内容并验证真实用户路径。",
      en: "Operate pages, capture dynamic content, and verify user paths.",
    },
    icon: Globe2,
    tone: "blue",
    span: "md:col-span-2",
  },
  {
    scene: "local-environment",
    title: { zh: "本地环境", en: "Local" },
    summary: {
      zh: "管理终端、文件、运行时和本地服务。",
      en: "Manage shells, files, runtimes, and local services.",
    },
    icon: Cpu,
    tone: "violet",
    span: "md:col-span-1",
  },
  {
    scene: "social-platforms",
    title: { zh: "社交平台", en: "Social" },
    summary: {
      zh: "处理发布、互动、检索和内容分发。",
      en: "Handle posting, interaction, search, and distribution.",
    },
    icon: MessagesSquare,
    tone: "sky",
    span: "md:col-span-1",
  },
  {
    scene: "nextclaw-official",
    title: { zh: "NextClaw 官方", en: "NextClaw Official" },
    summary: {
      zh: "优先查看由 NextClaw 维护的原生能力。",
      en: "Browse native capabilities maintained by NextClaw.",
    },
    icon: Sparkles,
    tone: "teal",
    span: "md:col-span-2",
  },
];

export const MARKETPLACE_SHELF_FALLBACK_VISUAL: Omit<MarketplaceShelfSceneVisual, "scene"> = {
  icon: Sparkles,
  tone: "dark",
  span: "md:col-span-2",
};

export const MARKETPLACE_SHELF_TONE_STYLES = {
  dark: {
    card: "border-gray-200/80 bg-white text-gray-950",
    icon: "border-gray-200 bg-gray-50 text-gray-600",
    title: "text-gray-950",
    text: "text-gray-500",
    meta: "text-gray-400",
  },
  blue: {
    card: "border-gray-200/80 bg-white text-gray-950",
    icon: "border-gray-200 bg-gray-50 text-gray-600",
    title: "text-gray-950",
    text: "text-gray-500",
    meta: "text-gray-400",
  },
  green: {
    card: "border-gray-200/80 bg-white text-gray-950",
    icon: "border-gray-200 bg-gray-50 text-gray-600",
    title: "text-gray-950",
    text: "text-gray-500",
    meta: "text-gray-400",
  },
  amber: {
    card: "border-gray-200/80 bg-white text-gray-950",
    icon: "border-gray-200 bg-gray-50 text-gray-600",
    title: "text-gray-950",
    text: "text-gray-500",
    meta: "text-gray-400",
  },
  violet: {
    card: "border-gray-200/80 bg-white text-gray-950",
    icon: "border-gray-200 bg-gray-50 text-gray-600",
    title: "text-gray-950",
    text: "text-gray-500",
    meta: "text-gray-400",
  },
  sky: {
    card: "border-gray-200/80 bg-white text-gray-950",
    icon: "border-gray-200 bg-gray-50 text-gray-600",
    title: "text-gray-950",
    text: "text-gray-500",
    meta: "text-gray-400",
  },
  teal: {
    card: "border-gray-200/80 bg-white text-gray-950",
    icon: "border-gray-200 bg-gray-50 text-gray-600",
    title: "text-gray-950",
    text: "text-gray-500",
    meta: "text-gray-400",
  },
} as const;
