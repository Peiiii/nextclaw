import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateAgent, useDeleteAgent, useAgents } from '@/hooks/agents/useAgents';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';
import { AgentAvatar } from '@/components/common/AgentAvatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PageLayout } from '@/components/layout/page-layout';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Bot, House, MessageCircle, Plus, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';

type CreateFormState = {
  id: string;
  displayName: string;
  avatar: string;
  home: string;
};

const EMPTY_FORM: CreateFormState = {
  id: '',
  displayName: '',
  avatar: '',
  home: ''
};

const CARD_TONES = [
  {
    strip: 'bg-[#efc37a]',
    chip: 'border-[#f2d7a7] bg-[#fff8eb] text-[#8d5a18]'
  },
  {
    strip: 'bg-[#8fd4c0]',
    chip: 'border-[#bde6da] bg-[#effbf7] text-[#156653]'
  },
  {
    strip: 'bg-[#b7c9fb]',
    chip: 'border-[#d7e2ff] bg-[#f4f7ff] text-[#2d4d8f]'
  }
] as const;

function resolveAgentTone(index: number, builtIn: boolean) {
  if (builtIn) {
    return {
      strip: 'bg-[#e6b765]',
      chip: 'border-[#f2d19c] bg-[#fff8ec] text-[#90550d]'
    };
  }
  return CARD_TONES[index % CARD_TONES.length];
}

export function AgentsPage() {
  const navigate = useNavigate();
  const agentsQuery = useAgents();
  const createAgent = useCreateAgent();
  const deleteAgent = useDeleteAgent();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const setSessionListSnapshot = useChatSessionListStore((state) => state.setSnapshot);

  const agents = useMemo(() => agentsQuery.data?.agents ?? [], [agentsQuery.data?.agents]);
  const sortedAgents = useMemo(
    () =>
      [...agents].sort(
        (left, right) =>
          Number(Boolean(right.builtIn)) - Number(Boolean(left.builtIn)) ||
          left.id.localeCompare(right.id)
      ),
    [agents]
  );

  const handleCreate = async () => {
    await createAgent.mutateAsync({
      data: {
        id: form.id,
        ...(form.displayName.trim() ? { displayName: form.displayName.trim() } : {}),
        ...(form.avatar.trim() ? { avatar: form.avatar.trim() } : {}),
        ...(form.home.trim() ? { home: form.home.trim() } : {})
      }
    });
    setForm(EMPTY_FORM);
    setIsCreateDialogOpen(false);
  };

  const startChatWithAgent = (agentId: string) => {
    setSessionListSnapshot({
      selectedAgentId: agentId,
      selectedSessionKey: null
    });
    navigate('/chat');
  };

  return (
    <PageLayout className="space-y-5">
      <section className="relative overflow-hidden rounded-[28px] border border-[#f0d6aa] bg-[linear-gradient(135deg,#fff7ea_0%,#fff9f1_32%,#f2fbff_100%)] px-5 py-5 sm:px-6">
        <div className="absolute inset-y-0 right-0 w-[46%] bg-[radial-gradient(circle_at_top_right,rgba(255,215,163,0.52),transparent_54%)]" />
        <div className="absolute -bottom-10 left-8 h-32 w-32 rounded-full bg-[#ffe6c0]/55 blur-3xl" />
        <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-center">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-[#9b6118]">
              <Sparkles className="h-3.5 w-3.5" />
              {t('agentsHeroEyebrow')}
            </div>
            <div className="space-y-2">
              <h1 className="max-w-2xl text-[30px] font-semibold leading-tight tracking-[-0.05em] text-[#2f2212] sm:text-[38px]">
                {t('agentsHeroTitle')}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-[#6d5841] sm:text-[15px] sm:leading-7">
                {t('agentsHeroDescription')}
              </p>
            </div>
            <div className="pt-1">
              <div className="inline-flex items-center gap-3 rounded-2xl border border-[#f2d5a4] bg-white/82 px-3 py-2 text-[#7a4d12] shadow-[0_14px_30px_rgba(167,117,47,0.07)]">
                <span className="text-[11px] font-semibold tracking-[0.14em]">
                  {t('agentsOverviewTotal')}
                </span>
                <span className="text-xl font-semibold tracking-[-0.04em] text-[#1f2937]">
                  {agents.length}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-3">
            <Button
              type="button"
              className="h-10 rounded-2xl bg-[#1f5c4d] px-5 text-sm font-semibold text-white hover:bg-[#184d40]"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('agentsCreateButton')}
            </Button>
            <div className="rounded-2xl border border-white/70 bg-white/72 px-4 py-3 text-xs leading-6 text-[#6d5841] shadow-[0_18px_40px_rgba(167,117,47,0.08)]">
              {t('agentsCreateDialogHint')}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agentsQuery.isLoading ? (
          <Card className="md:col-span-2 xl:col-span-3 border-dashed border-[#d9dce3] bg-white/70">
            <CardContent className="py-14 text-center text-sm text-gray-500">
              {t('agentsLoading')}
            </CardContent>
          </Card>
        ) : sortedAgents.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3 overflow-hidden border-dashed border-[#d9dce3] bg-[linear-gradient(135deg,#fff7ea_0%,#f4fbff_100%)]">
            <CardContent className="flex min-h-[240px] flex-col items-center justify-center px-6 py-14 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/80 shadow-[0_18px_44px_rgba(0,0,0,0.08)]">
                <Bot className="h-8 w-8 text-[#d39a3b]" />
              </div>
              <div className="text-lg font-semibold text-[#2f2212]">{t('agentsEmpty')}</div>
              <p className="mt-2 max-w-md text-sm leading-6 text-[#78644d]">
                {t('agentsEmptyDescription')}
              </p>
              <Button
                type="button"
                className="mt-5 rounded-2xl bg-[#1f5c4d] px-5 text-white hover:bg-[#184d40]"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('agentsCreateButton')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          sortedAgents.map((agent, index) => {
            const tone = resolveAgentTone(index, Boolean(agent.builtIn));
            return (
              <Card
                key={agent.id}
                className="overflow-hidden border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
              >
                <div className={cn('h-1.5 w-full', tone.strip)} />
                <CardContent className="flex h-full flex-col gap-4 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <AgentAvatar
                      agentId={agent.id}
                      displayName={agent.displayName}
                      avatarUrl={agent.avatarUrl}
                      className="h-11 w-11 shrink-0"
                    />
                    <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-lg font-semibold tracking-[-0.03em] text-[#1f2937]">
                          {agent.displayName?.trim() || agent.id}
                        </div>
                        {agent.builtIn ? (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                              tone.chip
                            )}
                          >
                            <ShieldCheck className="h-3 w-3" />
                            {t('agentsCardBuiltInTag')}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#94a3b8]">
                        @{agent.id}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm leading-6 text-[#64748b]">
                    {agent.builtIn
                      ? t('agentsCardBuiltInSummary')
                      : t('agentsCardCustomSummary')}
                  </p>

                  <div className="mt-auto flex flex-col gap-4">
                    <div className="border-t border-gray-100 pt-3">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94a3b8]">
                        <House className="h-3.5 w-3.5" />
                        {t('agentsCardHomeLabel')}
                      </div>
                      <div className="mt-1.5 break-all text-sm leading-6 text-[#475569]">
                        {agent.workspace ?? '-'}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        className="h-9 rounded-xl bg-[#1f5c4d] px-4 text-white hover:bg-[#184d40]"
                        onClick={() => startChatWithAgent(agent.id)}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        {t('agentsCardStartChat')}
                      </Button>
                      {!agent.builtIn ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 rounded-xl px-3 text-xs text-[#7b8794] hover:bg-[#f3f4f6] hover:text-[#475569]"
                          onClick={() => deleteAgent.mutate({ agentId: agent.id })}
                          disabled={deleteAgent.isPending}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          {t('agentsRemoveAction')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open && !createAgent.isPending) {
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="overflow-hidden border-none bg-[linear-gradient(180deg,#fff9f1_0%,#ffffff_24%)] p-0 sm:max-w-xl">
          <div className="border-b border-[#f0e2c8] px-6 py-6">
            <DialogHeader className="text-left">
              <DialogTitle>{t('agentsCreateDialogTitle')}</DialogTitle>
              <DialogDescription>{t('agentsCreateDialogDescription')}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4 px-6 py-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                value={form.id}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, id: event.target.value }))
                }
                placeholder={t('agentsFormIdPlaceholder')}
              />
              <Input
                value={form.displayName}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    displayName: event.target.value
                  }))
                }
                placeholder={t('agentsFormNamePlaceholder')}
              />
              <Input
                value={form.avatar}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, avatar: event.target.value }))
                }
                placeholder={t('agentsFormAvatarPlaceholder')}
              />
              <Input
                value={form.home}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, home: event.target.value }))
                }
                placeholder={t('agentsFormHomePlaceholder')}
              />
            </div>
            <div className="rounded-2xl border border-[#efe3ca] bg-[#fff9ef] px-4 py-3 text-xs leading-6 text-[#7a6246]">
              {t('agentsCreateDialogHint')}
            </div>
          </div>
          <DialogFooter className="border-t border-[#f1e7d4] px-6 py-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={createAgent.isPending}
            >
              {t('cancel')}
            </Button>
            <Button
              type="button"
              className="rounded-2xl bg-[#1f5c4d] px-5 text-white hover:bg-[#184d40]"
              onClick={() => void handleCreate()}
              disabled={createAgent.isPending || form.id.trim().length === 0}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('agentsCreateAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
