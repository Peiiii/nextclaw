import { parseSystemObjectReferenceUri } from "@nextclaw/shared";
import { useInfiniteNcpSessions } from "@/features/chat";
import { parseSessionKeyFromPanelUrl } from "@/features/chat";
import { useAgentIdentity } from "@/shared/components/common/agent-identity/use-agent-identity";
import { parseResourceUri } from "@/shared/lib/resource-uri";
import { useState } from "react";
import {
  Plug,
  ListTodo,
  Bot,
  Folder,
  Sparkles,
  Inbox,
  AlarmClock,
  AppWindow,
  BookOpen,
  Boxes,
  Eye,
  File,
  FolderTree,
  GitBranch,
  Github,
  Globe,
  LayoutDashboard,
  Link2,
  MessageSquare,
  PanelsTopLeft,
  Plus,
} from "lucide-react";
import { usePanelApps } from "@/features/panel-apps";
import { readPanelAppIdFromParsedResourceUri } from "@/features/right-panel-resources/utils/right-panel-resource-uri.utils";
import type { DocBrowserDockIcon } from "@/shared/components/doc-browser/types/doc-browser.types";
import { FileTypeIcon } from "@/shared/components/file-type-icon";

const RESOURCE_ICONS = {
  mcp: Plug,
  work: ListTodo,
  agent: Bot,
  project: Folder,
  skill: Sparkles,
  inbox: Inbox,
  session: MessageSquare,
  file: File,
  app: AppWindow,
  docs: BookOpen,
  website: Globe,
  generic: Link2,
  page: PanelsTopLeft,
  overview: LayoutDashboard,
  "child-sessions": GitBranch,
  "project-files": FolderTree,
  cron: AlarmClock,
  "continuous-attention": Eye,
};
const OBJECT_TYPE_ICONS: Record<string, keyof typeof RESOURCE_ICONS> = {
  agent: "agent",
  project: "project",
  skill: "skill",
  "cron-job": "cron",
  "inbox-delivery": "inbox",
  "service-app": "app",
  "mcp-server": "mcp",
  "project-work": "work",
};
const BUILTIN_ICONS: Record<string, typeof Globe> = {
  apps: Boxes,
  docs: BookOpen,
  github: Github,
  "new-tab": Plus,
  "panel-app": AppWindow,
  "service-apps": AppWindow,
};

function resourceTypeIcon(
  uri: string,
  appId: string | null,
): keyof typeof RESOURCE_ICONS {
  if (uri.startsWith("nextclaw://workspace?")) {
    const kind = new URL(uri).searchParams.get("page");
    return kind && Object.hasOwn(RESOURCE_ICONS, kind)
      ? (kind as keyof typeof RESOURCE_ICONS)
      : "page";
  }
  const object = parseSystemObjectReferenceUri(uri);
  if (object) return OBJECT_TYPE_ICONS[object.objectType] ?? "generic";
  if (
    uri.startsWith("nextclaw://skill/") ||
    uri.startsWith("nextclaw://marketplace-detail/skill")
  )
    return "skill";
  if (uri.startsWith("nextclaw://page?")) return "page";
  if (uri.startsWith("nextclaw://chat-session")) return "session";
  if (
    uri.startsWith("nextclaw://workspace-file") ||
    uri.startsWith("file:") ||
    uri.startsWith("nextclaw://file/")
  )
    return "file";
  if (
    appId ||
    uri.startsWith("nextclaw://apps") ||
    uri.startsWith("nextclaw://marketplace")
  )
    return "app";
  if (uri.startsWith("nextclaw://docs")) return "docs";
  return /^https?:/.test(uri) ? "website" : "generic";
}

function appIcon(value?: string): DocBrowserDockIcon | undefined {
  if (!value) return undefined;
  return /^(https?:|data:image\/|\/)/.test(value)
    ? { type: "url", url: value }
    : { type: "text", value };
}

function PanelAppResourceIcon({ uri, appId }: { uri: string; appId: string }) {
  const apps = usePanelApps();
  return (
    <ResourceIcon
      uri={uri}
      specific={appIcon(
        apps.data?.entries.find((entry) => entry.appId === appId)?.icon,
      )}
    />
  );
}

function ConversationResourceIcon({
  uri,
  sessionKey,
}: {
  uri: string;
  sessionKey: string;
}) {
  const sessions = useInfiniteNcpSessions({ pageSize: 100 });
  const session = sessions.data?.pages
    .flatMap((page) => page.sessions)
    .find((item) => item.sessionId === sessionKey);
  const identity = useAgentIdentity(session?.agentId);
  return (
    <ResourceIcon
      uri={uri}
      specific={
        identity?.avatarUrl
          ? { type: "url", url: identity.avatarUrl }
          : undefined
      }
    />
  );
}

function AgentResourceIcon({ uri, agentId }: { uri: string; agentId: string }) {
  const identity = useAgentIdentity(agentId);
  return (
    <ResourceIcon
      uri={uri}
      specific={
        identity?.avatarUrl
          ? { type: "url", url: identity.avatarUrl }
          : undefined
      }
    />
  );
}

export function PageResourceIcon({
  uri,
  icon,
}: {
  uri: string;
  icon?: DocBrowserDockIcon;
}) {
  const appId = readPanelAppIdFromParsedResourceUri(parseResourceUri(uri));
  const sessionKey = parseSessionKeyFromPanelUrl(uri);
  const object = parseSystemObjectReferenceUri(uri);
  if (object?.objectType === "agent" && !icon)
    return <AgentResourceIcon uri={uri} agentId={object.objectId} />;
  if (sessionKey && !icon)
    return <ConversationResourceIcon uri={uri} sessionKey={sessionKey} />;
  return appId && !icon ? (
    <PanelAppResourceIcon uri={uri} appId={appId} />
  ) : (
    <ResourceIcon uri={uri} specific={icon} />
  );
}

function ResourceIcon({
  uri,
  specific,
}: {
  uri: string;
  specific?: DocBrowserDockIcon;
}) {
  const appId = readPanelAppIdFromParsedResourceUri(parseResourceUri(uri));
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (
    specific?.type === "url" &&
    specific.url !== failedUrl &&
    /^(https?:\/\/|data:image\/|\/)/.test(specific.url)
  ) {
    return (
      <img
        src={specific.url}
        alt=""
        referrerPolicy="no-referrer"
        className="inline-block h-[1em] w-[1em] shrink-0 rounded-sm object-contain align-[-0.12em]"
        onError={() => setFailedUrl(specific.url)}
      />
    );
  }
  if (specific?.type === "text")
    return (
      <span
        aria-hidden="true"
        className="inline-block h-[1em] w-[1em] shrink-0 overflow-hidden text-center leading-none"
      >
        {specific.value}
      </span>
    );
  let pathname = uri;
  try {
    pathname = new URL(uri).searchParams.get("path") ?? new URL(uri).pathname;
  } catch {
    /* Local file link. */
  }
  if (
    resourceTypeIcon(uri, appId) === "file" &&
    /\.[a-z0-9]{1,8}(?:[?#]|$)/i.test(pathname)
  )
    return <FileTypeIcon fileName={pathname} size="compact" />;
  const Icon =
    (specific?.type === "builtin" && BUILTIN_ICONS[specific.name]) ||
    RESOURCE_ICONS[resourceTypeIcon(uri, appId)];
  return (
    <Icon
      aria-hidden="true"
      className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.12em]"
    />
  );
}
