import { useMemo, useState } from "react";
import {
  useDeleteAgent,
  useAgents,
  useUpdateAgent,
} from "@/shared/hooks/use-agents";
import { useConfig, useConfigMeta } from "@/shared/hooks/use-config";
import type { AgentProfileView } from "@/shared/lib/api";
import {
  AgentEditDialog,
  type AgentEditFormState,
} from "@/features/agents/components/agent-dialogs";
import {
  buildSessionTypeOptions,
  normalizeSessionType,
  resolveAgentRuntimeSessionType,
  resolveSessionTypeLabel,
  usePresenter,
  useNcpChatSessionTypes,
} from "@/features/chat";
import { AgentAvatar } from "@/shared/components/common/agent-avatar";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { TagChip } from "@/shared/components/ui/tag-chip";
import { PageLayout } from "@/app/components/layout/page-layout";
import { t } from "@/shared/lib/i18n";
import { buildProviderModelCatalog } from "@/shared/lib/provider-models";
import { cn } from "@/shared/lib/utils";
import {
  Bot,
  House,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

const AGENT_CREATION_PROMPT =
  "请直接创建一个默认示例 Agent，不要问我问题。创建完成后，简单告诉我它能做什么。";

function AgentsHero(props: { agentCount: number; onCreate: () => void }) {
  const { agentCount, onCreate } = props;

  return (
    <section className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-gray-950">
            {t("agentsHeroEyebrow")}
          </h1>
          <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-500">
            {agentCount}
          </span>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-gray-500">
          {t("agentsHeroDescription")}
        </p>
      </div>
      <Button
        type="button"
        variant="primary"
        className="h-9 shrink-0 rounded-xl px-4 text-sm font-semibold"
        onClick={onCreate}
      >
        <Plus className="mr-2 h-4 w-4" />
        {t("agentsCreateButton")}
      </Button>
    </section>
  );
}

function AgentActionMenuItem(props: {
  icon: typeof Pencil;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
}) {
  const {
    icon: Icon,
    label,
    disabled = false,
    destructive = false,
    onClick,
  } = props;

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-gray-700 hover:bg-gray-100",
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

function AgentListCard(props: {
  agent: AgentProfileView;
  runtimeOptions: { value: string; label: string }[];
  defaultRuntimeLabel: string;
  updatePending: boolean;
  deletePending: boolean;
  onStartChat: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    agent,
    runtimeOptions,
    defaultRuntimeLabel,
    updatePending,
    deletePending,
    onStartChat,
    onEdit,
    onDelete,
  } = props;
  const runtimeValue = agent.runtime?.trim() || agent.engine?.trim() || "";
  const runtimeLabel = runtimeValue
    ? (runtimeOptions.find(
        (option) => option.value === normalizeSessionType(runtimeValue),
      )?.label ?? resolveSessionTypeLabel(runtimeValue))
    : defaultRuntimeLabel;

  return (
    <Card className="group overflow-hidden border border-gray-200 bg-white shadow-none transition-colors duration-200 hover:border-gray-300">
      <CardContent className="relative flex h-full flex-col gap-3 px-3.5 py-3.5">
        <div className="flex items-start gap-2.5 pr-16">
          <AgentAvatar
            agentId={agent.id}
            displayName={agent.displayName}
            avatarUrl={agent.avatarUrl}
            className="h-9 w-9 shrink-0"
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <div className="truncate text-sm font-semibold text-gray-950">
                {agent.displayName?.trim() || agent.id}
              </div>
              {agent.builtIn ? (
                <TagChip
                  tone="warning"
                  className="h-5 gap-1 border-amber-200 bg-amber-50 px-1.5 text-[10px] text-amber-700"
                >
                  <ShieldCheck className="h-3 w-3" />
                  {t("agentsCardBuiltInTag")}
                </TagChip>
              ) : null}
            </div>
            <div className="truncate text-xs text-gray-400">@{agent.id}</div>
          </div>
        </div>

        <div className="absolute right-2.5 top-2.5 flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-gray-400 hover:text-gray-800"
            aria-label={t("agentsCardStartChat")}
            title={t("agentsCardStartChat")}
            onClick={onStartChat}
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-gray-400 hover:text-gray-800"
                aria-label={t("chatSessionMoreActions")}
                title={t("chatSessionMoreActions")}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-44 p-1.5">
              <AgentActionMenuItem
                icon={Pencil}
                label={t("agentsEditAction")}
                onClick={onEdit}
                disabled={updatePending}
              />
              {!agent.builtIn ? (
                <AgentActionMenuItem
                  icon={Trash2}
                  label={t("agentsRemoveAction")}
                  onClick={onDelete}
                  disabled={deletePending}
                  destructive
                />
              ) : null}
            </PopoverContent>
          </Popover>
        </div>

        <p className="line-clamp-2 min-h-10 text-sm leading-5 text-gray-600">
          {agent.description?.trim() ||
            (agent.builtIn
              ? t("agentsCardBuiltInSummary")
              : t("agentsCardCustomSummary"))}
        </p>

        <div className="mt-auto grid gap-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-gray-300" />
            <span className="truncate">{runtimeLabel}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <House className="h-3.5 w-3.5 shrink-0 text-gray-300" />
            <span className="truncate">{agent.workspace ?? "-"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentsPage() {
  const presenter = usePresenter();
  const agentsQuery = useAgents();
  const configQuery = useConfig();
  const configMetaQuery = useConfigMeta();
  const sessionTypesQuery = useNcpChatSessionTypes();
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();
  const [editingAgent, setEditingAgent] = useState<AgentProfileView | null>(
    null,
  );
  const agents = useMemo(
    () => agentsQuery.data?.agents ?? [],
    [agentsQuery.data?.agents],
  );
  const sortedAgents = useMemo(
    () =>
      [...agents].sort(
        (left, right) =>
          Number(Boolean(right.builtIn)) - Number(Boolean(left.builtIn)) ||
          left.id.localeCompare(right.id),
      ),
    [agents],
  );
  const providerCatalog = useMemo(
    () =>
      buildProviderModelCatalog({
        config: configQuery.data,
        meta: configMetaQuery.data,
        onlyConfigured: true,
      }),
    [configMetaQuery.data, configQuery.data],
  );
  const runtimeOptions = useMemo(
    () => buildSessionTypeOptions(sessionTypesQuery.data?.options ?? []),
    [sessionTypesQuery.data?.options],
  );
  const defaultRuntime = useMemo(
    () => normalizeSessionType(sessionTypesQuery.data?.defaultType ?? "native"),
    [sessionTypesQuery.data?.defaultType],
  );
  const defaultRuntimeLabel = useMemo(
    () =>
      runtimeOptions.find((option) => option.value === defaultRuntime)?.label ??
      resolveSessionTypeLabel(defaultRuntime),
    [defaultRuntime, runtimeOptions],
  );

  const handleStartEdit = (agent: AgentProfileView) => {
    setEditingAgent(agent);
  };

  const handleUpdate = async (agentId: string, form: AgentEditFormState) => {
    await updateAgent.mutateAsync({
      agentId,
      data: {
        displayName: form.displayName,
        description: form.description,
        avatar: form.avatar,
        model: form.model,
        ...(form.runtime.trim()
          ? { runtime: form.runtime.trim() }
          : { runtime: "" }),
      },
    });
    setEditingAgent(null);
  };

  const startChatWithAgent = (agent: AgentProfileView) => {
    presenter.chatSessionListManager.startAgentDraftChat(
      agent.id,
      resolveAgentRuntimeSessionType(agent, defaultRuntime),
    );
  };

  return (
    <PageLayout className="space-y-5">
      <AgentsHero
        agentCount={agents.length}
        onCreate={() =>
          presenter.startAgentCreationDraft(AGENT_CREATION_PROMPT)
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agentsQuery.isLoading ? (
          <Card className="md:col-span-2 xl:col-span-3 border-dashed border-[#d9dce3] bg-white/70">
            <CardContent className="py-14 text-center text-sm text-gray-500">
              {t("agentsLoading")}
            </CardContent>
          </Card>
        ) : sortedAgents.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3 overflow-hidden border-dashed border-[#d9dce3] bg-[linear-gradient(135deg,#fff7ea_0%,#f4fbff_100%)]">
            <CardContent className="flex min-h-[240px] flex-col items-center justify-center px-6 py-14 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/80 shadow-[0_18px_44px_rgba(0,0,0,0.08)]">
                <Bot className="h-8 w-8 text-[#d39a3b]" />
              </div>
              <div className="text-lg font-semibold text-[#2f2212]">
                {t("agentsEmpty")}
              </div>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#78644d]">
                {t("agentsEmptyDescription")}
              </p>
              <Button
                type="button"
                variant="primary"
                className="mt-5 rounded-2xl px-5"
                onClick={() =>
                  presenter.startAgentCreationDraft(AGENT_CREATION_PROMPT)
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("agentsCreateButton")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          sortedAgents.map((agent) => (
            <AgentListCard
              key={agent.id}
              agent={agent}
              runtimeOptions={runtimeOptions}
              defaultRuntimeLabel={defaultRuntimeLabel}
              updatePending={updateAgent.isPending}
              deletePending={deleteAgent.isPending}
              onStartChat={() => startChatWithAgent(agent)}
              onEdit={() => handleStartEdit(agent)}
              onDelete={() => deleteAgent.mutate({ agentId: agent.id })}
            />
          ))
        )}
      </div>

      <AgentEditDialog
        agent={editingAgent}
        pending={updateAgent.isPending}
        providerCatalog={providerCatalog}
        runtimeOptions={runtimeOptions}
        defaultRuntime={defaultRuntime}
        onOpenChange={(open) => {
          if (!open && !updateAgent.isPending) {
            setEditingAgent(null);
          }
        }}
        onSubmit={handleUpdate}
      />
    </PageLayout>
  );
}
