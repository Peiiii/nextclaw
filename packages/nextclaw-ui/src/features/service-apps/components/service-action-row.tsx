import { useState } from "react";
import type {
  AgentProfileView,
  ServiceActionGrantView,
  ServiceActionListView,
} from "@nextclaw/client-sdk";
import { Bot, ShieldCheck, ShieldPlus, Trash2, Wrench } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { t } from "@/shared/lib/i18n";

type ServiceActionView = ServiceActionListView["actions"][number];

export function ServiceActionRow({
  action,
  grants,
  agents,
  grantAgentPending,
  onGrantAgent,
  onRevoke,
}: {
  action: ServiceActionView;
  grants: ServiceActionGrantView[];
  agents: AgentProfileView[];
  grantAgentPending: boolean;
  onGrantAgent: (actionId: string, agentId: string) => void;
  onRevoke: (grant: ServiceActionGrantView) => void;
}) {
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const grantedAgentIds = new Set(
    grants.flatMap((grant) =>
      grant.caller.surface === "agent" ? [grant.caller.agentId] : [],
    ),
  );
  const availableAgents = agents.filter((agent) => !grantedAgentIds.has(agent.id));
  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-foreground">
              {action.title ?? action.name}
            </div>
            {action.description ? (
              <div className="truncate text-[11px] text-muted-foreground">
                {action.description}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action.runtimeState ? (
            <span className="text-[11px] text-muted-foreground">
              {t(`serviceAppsRuntimeState_${action.runtimeState}`)}
            </span>
          ) : null}
          <span className="text-[11px] text-muted-foreground">{action.risk}</span>
          <Popover open={agentMenuOpen} onOpenChange={setAgentMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={grantAgentPending || availableAgents.length === 0}
                className="ml-1 rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border disabled:cursor-not-allowed disabled:opacity-40"
                title={t("serviceAppsGrantToAgent")}
                aria-label={t("serviceAppsGrantToAgent")}
              >
                <ShieldPlus className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 rounded-xl p-1.5">
              <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
                {t("serviceAppsGrantToAgent")}
              </div>
              {availableAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    onGrantAgent(action.id, agent.id);
                    setAgentMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
                >
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="min-w-0 truncate">
                    {agent.displayName?.trim() || agent.id}
                  </span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {grants.map((grant) => (
        <div
          key={`${grant.caller.surface}:${getGrantCallerId(grant)}:${grant.actionId}`}
          className="mt-1.5 flex items-center justify-between gap-2 pl-8"
        >
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-500" />
            <span className="truncate">
              {t("serviceAppsGrantedTo")} {getGrantCallerId(grant)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onRevoke(grant)}
            className="rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-rose-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
            title={t("serviceAppsRevokeGrant")}
            aria-label={t("serviceAppsRevokeGrant")}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

function getGrantCallerId(grant: ServiceActionGrantView): string {
  return grant.caller.surface === "panel-app"
    ? grant.caller.appId
    : grant.caller.agentId;
}
