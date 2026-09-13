import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bot,
  BrainCircuit,
  AlarmClock,
  Cpu,
  Download,
  Inbox,
  KeyRound,
  Keyboard,
  MessageCircle,
  MessageSquare,
  MonitorCog,
  Palette,
  Puzzle,
  Search,
  Settings,
  Shield,
  Sparkles,
  Wifi,
  Wrench,
} from "lucide-react";

type Translate = (key: string) => string;

export type AppNavigationItem = {
  target: string;
  label: string;
  icon: LucideIcon;
};

export type AppNavigationSection = {
  label: string;
  items: AppNavigationItem[];
};

type SettingsNavigationOptions = {
  includeKeyboardShortcuts?: boolean;
  includeDesktopCapabilities?: boolean;
};

export function matchesRouteTarget(pathname: string, target: string): boolean {
  const normalizedPath = pathname.toLowerCase();
  const normalizedTarget = target.toLowerCase();
  return (
    normalizedPath === normalizedTarget ||
    normalizedPath.startsWith(`${normalizedTarget}/`)
  );
}

export function isMainWorkspaceRoute(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  return (
    normalized === "/resource" ||
    normalized === "/chat" ||
    normalized.startsWith("/chat/") ||
    normalized === "/inbox" ||
    normalized.startsWith("/inbox/") ||
    normalized === "/skills" ||
    normalized.startsWith("/skills/") ||
    normalized === "/cron" ||
    normalized.startsWith("/cron/") ||
    normalized === "/agents" ||
    normalized.startsWith("/agents/") ||
    normalized === "/projects" ||
    normalized.startsWith("/projects/") ||
    normalized.startsWith("/apps/panel/")
  );
}

export function isChatSessionDetailRoute(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  return normalized.startsWith("/chat/") && normalized !== "/chat";
}

export function getMobileBottomNavItems(
  translate: Translate,
): AppNavigationItem[] {
  return [
    {
      target: "/chat",
      label: translate("chat"),
      icon: MessageCircle,
    },
    {
      target: "/inbox",
      label: translate("inboxTitle"),
      icon: Inbox,
    },
    {
      target: "/skills",
      label: translate("marketplaceFilterSkills"),
      icon: BrainCircuit,
    },
    {
      target: "/agents",
      label: translate("agentsPageTitle"),
      icon: Bot,
    },
    {
      target: "/settings",
      label: translate("settings"),
      icon: Settings,
    },
  ];
}

export function getMainSidebarNavItems(
  translate: Translate,
): AppNavigationItem[] {
  return [
    {
      target: "/chat",
      label: translate("chat"),
      icon: MessageCircle,
    },
    {
      target: "/inbox",
      label: translate("inboxTitle"),
      icon: Inbox,
    },
    {
      target: "/chat/cron",
      label: translate("cron"),
      icon: AlarmClock,
    },
    {
      target: "/chat/skills",
      label: translate("marketplaceFilterSkills"),
      icon: BrainCircuit,
    },
    {
      target: "/agents",
      label: translate("agentsPageTitle"),
      icon: Bot,
    },
  ];
}

export function getSettingsNavSections(
  translate: Translate,
  options: SettingsNavigationOptions = {},
): AppNavigationSection[] {
  const sections = [
    {
      label: translate("settingsGroupBasic"),
      items: [
        { target: "/model", label: translate("model"), icon: Cpu },
        { target: "/providers", label: translate("providers"), icon: Sparkles },
        { target: "/channels", label: translate("channels"), icon: MessageSquare },
      ],
    },
    {
      label: translate("settingsGroupCommon"),
      items: [
        { target: "/appearance", label: translate("appearance"), icon: Palette },
        { target: "/updates", label: translate("updates"), icon: Download },
        { target: "/search", label: translate("searchChannels"), icon: Search },
        { target: "/keyboard-shortcuts", label: translate("keyboardShortcuts"), icon: Keyboard },
      ],
    },
    {
      label: translate("settingsGroupSecurity"),
      items: [
        { target: "/security", label: translate("security"), icon: Shield },
        { target: "/privacy", label: translate("privacy"), icon: Activity },
        { target: "/secrets", label: translate("secrets"), icon: KeyRound },
        { target: "/desktop-capabilities", label: translate("desktopCapabilities"), icon: MonitorCog },
      ],
    },
    {
      label: translate("settingsGroupSystem"),
      items: [
        { target: "/remote", label: translate("remote"), icon: Wifi },
        { target: "/runtime", label: translate("runtime"), icon: Cpu },
        { target: "/marketplace/mcp", label: translate("marketplaceFilterMcp"), icon: Wrench },
        { target: "/extensions", label: translate("extensions"), icon: Puzzle },
      ],
    },
  ];
  return sections.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      (options.includeDesktopCapabilities !== false || item.target !== "/desktop-capabilities") &&
      (options.includeKeyboardShortcuts !== false || item.target !== "/keyboard-shortcuts")),
  })).filter((section) => section.items.length > 0);
}

export function getSettingsNavItems(
  translate: Translate,
  options: SettingsNavigationOptions = {},
): AppNavigationItem[] {
  return getSettingsNavSections(translate, options).flatMap((section) => section.items);
}

export function isSettingsRoute(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  if (normalized === "/settings") {
    return true;
  }
  return getSettingsNavItems((key) => key).some((item) =>
    matchesRouteTarget(normalized, item.target),
  );
}

export function resolveMobileRouteMeta(
  pathname: string,
  translate: Translate,
): {
  title: string;
  backTarget: string | null;
  backLabel: string | null;
} {
  const normalized = pathname.toLowerCase();
  const settingsItems = getSettingsNavItems(translate);
  if (normalized === "/resource") return { title: translate("resourcePageTitle"), backTarget: null, backLabel: null };

  if (isChatSessionDetailRoute(normalized)) {
    return {
      title: translate("chat"),
      backTarget: "/chat",
      backLabel: translate("chat"),
    };
  }

  if (normalized === "/chat") {
    return {
      title: translate("chat"),
      backTarget: null,
      backLabel: null,
    };
  }

  if (normalized === "/inbox" || normalized.startsWith("/inbox/")) {
    return {
      title: translate("inboxTitle"),
      backTarget: normalized === "/inbox" ? null : "/inbox",
      backLabel: translate("inboxTitle"),
    };
  }

  if (normalized === "/skills" || normalized.startsWith("/skills/")) {
    return {
      title: translate("marketplaceFilterSkills"),
      backTarget: null,
      backLabel: null,
    };
  }

  if (normalized === "/agents" || normalized.startsWith("/agents/")) {
    return {
      title: translate("agentsPageTitle"),
      backTarget: null,
      backLabel: null,
    };
  }

  if (normalized === "/projects" || normalized.startsWith("/projects/")) {
    return {
      title: translate("projectsTitle"),
      backTarget: "/chat",
      backLabel: translate("chat"),
    };
  }

  if (normalized.startsWith("/apps/panel/")) {
    return {
      title: translate("panelAppsTitle"),
      backTarget: "/chat",
      backLabel: translate("chat"),
    };
  }

  if (normalized === "/settings") {
    return {
      title: translate("settings"),
      backTarget: null,
      backLabel: null,
    };
  }

  for (const item of settingsItems) {
    if (matchesRouteTarget(normalized, item.target)) {
      return {
        title: item.label,
        backTarget: "/settings",
        backLabel: translate("settings"),
      };
    }
  }

  return {
    title: translate("settings"),
    backTarget: null,
    backLabel: null,
  };
}
