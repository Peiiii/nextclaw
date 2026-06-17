import { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import type { ConfigView, RuntimeConfigUpdate } from '@/shared/lib/api';
import { Button } from '@/shared/components/ui/button';
import { PageLayout } from '@/app/components/layout/page-layout';
import { t } from '@/shared/lib/i18n';
import { RuntimeConfigOverview } from '@/features/system-status/components/config/runtime-config-overview';
import { RuntimeAgentListCard } from '@/features/system-status/components/config/runtime-agent-list-card';
import { RuntimeBindingListCard } from '@/features/system-status/components/config/runtime-binding-list-card';
import { RuntimeEntryListCard } from '@/features/system-status/components/config/runtime-entry-list-card';
import { RuntimeSettingsCard } from '@/features/system-status/components/config/runtime-settings-card';
import {
  createEmptyRuntimeAgent,
  createEmptyRuntimeBinding,
  createEmptyRuntimeEntry,
  createRuntimeConfigEditorState,
  createRuntimeConfigUpdatePayload,
  type DmScope,
  type RuntimeEntryDraft
} from '@/features/system-status/utils/runtime-config-agent.utils';
import { toast } from 'sonner';
type UpdateRuntimeMutation = {
  mutate: (input: { data: RuntimeConfigUpdate }) => void;
  isPending: boolean;
};

export function RuntimeConfigEditor({
  config,
  updateRuntime
}: {
  config: ConfigView;
  updateRuntime: UpdateRuntimeMutation;
}) {
  const initialState = useMemo(() => createRuntimeConfigEditorState(config), [config]);
  const [agents, setAgents] = useState(initialState.agents);
  const [bindings, setBindings] = useState(initialState.bindings);
  const [runtimeEntries, setRuntimeEntries] = useState(initialState.runtimeEntries);
  const [dmScope, setDmScope] = useState<DmScope>(initialState.dmScope);
  const [companionEnabled, setCompanionEnabled] = useState(initialState.companionEnabled);
  const [defaultContextTokens, setDefaultContextTokens] = useState(initialState.defaultContextTokens);
  const [defaultEngine, setDefaultEngine] = useState(initialState.defaultEngine);

  const knownAgentIds = useMemo(() => {
    const ids = new Set<string>(['main']);
    agents.forEach((agent) => {
      const id = agent.id.trim();
      if (id) {
        ids.add(id);
      }
    });
    return ids;
  }, [agents]);

  const updateAgent = (index: number, patch: Partial<(typeof agents)[number]>) => {
    setAgents((previous) => previous.map((agent, cursor) => (cursor === index ? { ...agent, ...patch } : agent)));
  };
  const updateBinding = (index: number, next: (typeof bindings)[number]) => {
    setBindings((previous) => previous.map((binding, cursor) => (cursor === index ? next : binding)));
  };
  const updateRuntimeEntry = (index: number, patch: Partial<RuntimeEntryDraft>) => setRuntimeEntries((previous) => previous.map((entry, cursor) => (cursor === index ? { ...entry, ...patch } : entry)));

  const handleSave = () => {
    try {
      const data = createRuntimeConfigUpdatePayload({
        companionEnabled,
        agents,
        bindings,
        runtimeEntries,
        dmScope,
        defaultContextTokens,
        defaultEngine,
        knownAgentIds
      });
      updateRuntime.mutate({ data });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <PageLayout className="space-y-6">
      <RuntimeConfigOverview />
      <RuntimeSettingsCard
        companionEnabled={companionEnabled}
        dmScope={dmScope}
        defaultContextTokens={defaultContextTokens}
        defaultEngine={defaultEngine}
        onCompanionEnabledChange={setCompanionEnabled}
        onDmScopeChange={setDmScope}
        onDefaultContextTokensChange={setDefaultContextTokens}
        onDefaultEngineChange={setDefaultEngine}
      />
      <RuntimeEntryListCard
        entries={runtimeEntries}
        onUpdateEntry={updateRuntimeEntry}
        onRemoveEntry={(index) => setRuntimeEntries((previous) => previous.filter((_, cursor) => cursor !== index))}
        onAddEntry={() => setRuntimeEntries((previous) => [...previous, createEmptyRuntimeEntry()])}
      />
      <RuntimeAgentListCard
        agents={agents}
        onUpdateAgent={updateAgent}
        onRemoveAgent={(index) => setAgents((previous) => previous.filter((_, cursor) => cursor !== index))}
        onAddAgent={() => setAgents((previous) => [...previous, createEmptyRuntimeAgent()])}
        onSetDefaultAgent={(index, checked) =>
          setAgents((previous) => checked ? previous.map((entry, cursor) => ({ ...entry, default: cursor === index })) : previous.map((entry, cursor) => (cursor === index ? { ...entry, default: false } : entry)))
        }
      />
      <RuntimeBindingListCard
        bindings={bindings}
        onUpdateBinding={updateBinding}
        onRemoveBinding={(index) => setBindings((previous) => previous.filter((_, cursor) => cursor !== index))}
        onAddBinding={() => setBindings((previous) => [...previous, createEmptyRuntimeBinding()])}
      />
      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={updateRuntime.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {updateRuntime.isPending ? t('saving') : t('saveRuntimeSettings')}
        </Button>
      </div>
    </PageLayout>
  );
}
