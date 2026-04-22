import type { LucideIcon } from "lucide-react";
import {
  AlarmClock,
  Bot,
  BrainCircuit,
  Cpu,
  Download,
  History,
  KeyRound,
  MessageCircle,
  MessageSquare,
  Plug,
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
      target: "/security",
      label: translate("security"),
      icon: Shield,
    },
    {
      target: "/sessions",
      label: translate("sessions"),
      icon: History,
    },
    {
      target: "/secrets",
      label: translate("secrets"),
      icon: KeyRound,
    },
    {
      target: "/cron",
      label: translate("cron"),
      icon: AlarmClock,
    },
    {
      target: "/marketplace/plugins",
      label: translate("marketplaceFilterPlugins"),
      icon: Plug,
    },
    {
      target: "/marketplace/mcp",
      label: translate("marketplaceFilterMcp"),
      icon: Wrench,
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

  if (normalized.startsWith("/chat/") && normalized !== "/chat") {
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
