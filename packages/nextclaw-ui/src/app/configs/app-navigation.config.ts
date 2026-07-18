import type { LucideIcon } from "lucide-react";
import {
  Bot,
  BrainCircuit,
  AlarmClock,
  Cpu,
  Download,
  KeyRound,
  MessageCircle,
  MessageSquare,
  Palette,
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

function matchesRouteTarget(pathname: string, target: string): boolean {
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
    normalized === "/chat" ||
    normalized.startsWith("/chat/") ||
    normalized === "/skills" ||
    normalized.startsWith("/skills/") ||
    normalized === "/cron" ||
    normalized.startsWith("/cron/") ||
    normalized === "/agents" ||
    normalized.startsWith("/agents/")
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

export function getSettingsNavItems(
  translate: Translate,
): AppNavigationItem[] {
  return [
    {
      target: "/model",
      label: translate("model"),
      icon: Cpu,
    },
    {
      target: "/providers",
      label: translate("providers"),
      icon: Sparkles,
    },
    {
      target: "/channels",
      label: translate("channels"),
      icon: MessageSquare,
    },
    {
      target: "/search",
      label: translate("searchChannels"),
      icon: Search,
    },
    {
      target: "/appearance",
      label: translate("appearance"),
      icon: Palette,
    },
    {
      target: "/security",
      label: translate("security"),
      icon: Shield,
    },
    {
      target: "/runtime",
      label: translate("runtime"),
      icon: Cpu,
    },
    {
      target: "/updates",
      label: translate("updates"),
      icon: Download,
    },
    {
      target: "/remote",
      label: translate("remote"),
      icon: Wifi,
    },
    {
      target: "/secrets",
      label: translate("secrets"),
      icon: KeyRound,
    },
    {
      target: "/marketplace/mcp",
      label: translate("marketplaceFilterMcp"),
      icon: Wrench,
    },
  ];
}

export function getSettingsNavSections(
  translate: Translate,
): AppNavigationSection[] {
  const items = getSettingsNavItems(translate);
  return [
    {
      label: translate("settingsGroupBasic"),
      items: items.slice(0, 3),
    },
    {
      label: translate("settingsGroupAdvanced"),
      items: items.slice(3),
    },
  ];
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
