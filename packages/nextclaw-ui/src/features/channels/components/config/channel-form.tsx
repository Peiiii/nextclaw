import { useMemo, useState, useSyncExternalStore } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { LogoBadge } from '@/components/common/LogoBadge';
import { Button } from '@/components/ui/button';
import { StatusDot } from '@/components/ui/status-dot';
import { appClient } from '@/transport';
import { useConfig, useConfigMeta, useConfigSchema, useExecuteConfigAction, useUpdateChannel } from '@/hooks/useConfig';
import type { ConfigActionManifest, ConfigUiHints } from '@/api/types';
import { ChannelFormFieldsSection } from '@/features/channels/components/channel-form-fields-section';
import { WeixinChannelAuthSection } from '@/features/channels/components/config/weixin-channel-auth-section';
import { buildChannelFormDefinitions, type ChannelField, type ChannelFormBlock, type ChannelFormFieldSection } from '@/features/channels/utils/channel-form-fields.utils';
import { ConfigSplitDetailPane, ConfigSplitEmptyPane, ConfigSplitPaneBody, ConfigSplitPaneFooter, ConfigSplitPaneHeader } from '@/shared/components/config-split-page';
import { hintForPath } from '@/lib/config-hints';
import { resolveChannelTutorialUrl } from '@/lib/channel-tutorials';
import { t } from '@/lib/i18n';
import { getChannelLogo } from '@/lib/logos';
import { cn } from '@/lib/utils';

type ChannelFormProps = { channelName?: string };
type ChannelApplyState = { status: 'applying' | 'applied' | 'failed'; message?: string } | null;
type ChannelFormEditorProps = {
  actions: ConfigActionManifest[];
  channelConfig: Record<string, unknown>;
  channelLabel?: string;
  channelName: string;
  fields: ChannelField[];
  layoutBlocks: ChannelFormBlock[];
  tutorialUrl?: string;
  uiHints?: ConfigUiHints;
};

const EMPTY_CHANNEL_FIELDS: ChannelField[] = [];
const DEFAULT_CHANNEL_LAYOUT_BLOCKS: ChannelFormBlock[] = [{ type: 'fields', section: 'all' }];
const channelApplyListeners = new Set<() => void>();
const channelApplySnapshots = new Map<string, ChannelApplyState>();
let channelApplyUnsubscribe: null | (() => void) = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMergeRecords(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    next[key] = isRecord(next[key]) && isRecord(value) ? deepMergeRecords(next[key] as Record<string, unknown>, value) : value;
  }
  return next;
}

function buildScopeDraft(scope: string, value: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  let cursor = output;
  const segments = scope.split('.');
  for (let index = 0; index < segments.length - 1; index += 1) {
    cursor[segments[index]] = {};
    cursor = cursor[segments[index]] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]] = value;
  return output;
}

function resolveFieldsForSection(fields: ChannelField[], section: ChannelFormFieldSection) {
  return section === 'all' ? fields : fields.filter((field) => section === 'primary' ? field.section === 'primary' : field.section !== 'primary');
}

function buildJsonDrafts(channelConfig: Record<string, unknown>, fields: ChannelField[]) {
  const nextDrafts: Record<string, string> = {};
  fields.filter((field) => field.type === 'json').forEach((field) => {
    nextDrafts[field.name] = JSON.stringify(channelConfig[field.name] ?? {}, null, 2);
  });
  return nextDrafts;
}

function ensureChannelApplySubscription() {
  if (channelApplyUnsubscribe) {
    return;
  }
  channelApplyUnsubscribe = appClient.subscribe((event) => {
    if (event.type !== 'channel.config.apply-status') {
      return;
    }
    channelApplySnapshots.set(
      event.payload.channel,
      event.payload.status === 'started'
        ? { status: 'applying' }
        : event.payload.status === 'succeeded'
          ? { status: 'applied' }
          : { status: 'failed', message: event.payload.message }
    );
    channelApplyListeners.forEach((listener) => listener());
  });
}

function subscribeChannelApplyStore(listener: () => void) {
  channelApplyListeners.add(listener);
  ensureChannelApplySubscription();
  return () => {
    channelApplyListeners.delete(listener);
    if (!channelApplyListeners.size && channelApplyUnsubscribe) {
      channelApplyUnsubscribe();
      channelApplyUnsubscribe = null;
      channelApplySnapshots.clear();
    }
  };
}

function useChannelApplyState(channelName: string | undefined) {
  return useSyncExternalStore(subscribeChannelApplyStore, () => channelName ? channelApplySnapshots.get(channelName) ?? null : null, () => null);
}

function buildChannelApplyStatusView(channelApplyState: ChannelApplyState) {
  if (!channelApplyState) {
    return null;
  }
  if (channelApplyState.status === 'applying') {
    return { className: 'text-amber-600', label: t('channelConfigApplying') };
  }
  if (channelApplyState.status === 'applied') {
    return { className: 'text-emerald-600', label: t('channelConfigApplied') };
  }
  return { className: 'text-red-600', label: `${t('channelConfigApplyFailed')}${channelApplyState.message ? `: ${channelApplyState.message}` : ''}` };
}

function ChannelFormHeader(props: {
  channelApplyStatus: ReturnType<typeof buildChannelApplyStatusView>;
  channelLabel?: string;
  channelName: string;
  enabled: boolean;
  tutorialUrl?: string;
}) {
  return (
    <ConfigSplitPaneHeader className="px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <LogoBadge
              name={props.channelName}
              src={getChannelLogo(props.channelName)}
              className={cn('h-9 w-9 rounded-lg border', props.enabled ? 'border-primary/30 bg-white' : 'border-gray-200/70 bg-white')}
              imgClassName="h-5 w-5 object-contain"
              fallback={<span className="text-sm font-semibold uppercase text-gray-500">{props.channelName[0]}</span>}
            />
            <h3 className="truncate text-lg font-semibold text-gray-900 capitalize">{props.channelLabel}</h3>
          </div>
          <p className="mt-2 text-sm text-gray-500">{t('channelsFormDescription')}</p>
          {props.channelApplyStatus ? <p className={cn('mt-2 text-xs font-medium', props.channelApplyStatus.className)}>{props.channelApplyStatus.label}</p> : null}
          {props.tutorialUrl ? (
            <a href={props.tutorialUrl} className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary transition-colors hover:text-primary-hover">
              <BookOpen className="h-3.5 w-3.5" />
              {t('channelsGuideTitle')}
            </a>
          ) : null}
        </div>
        <StatusDot status={props.enabled ? 'active' : 'inactive'} label={props.enabled ? t('statusActive') : t('statusInactive')} />
      </div>
    </ConfigSplitPaneHeader>
  );
}

function ChannelFormBlocks(props: {
  channelConfig: Record<string, unknown>;
  channelName: string;
  enabled: boolean;
  fields: ChannelField[];
  formData: Record<string, unknown>;
  jsonDrafts: Record<string, string>;
  layoutBlocks: ChannelFormBlock[];
  setJsonDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  uiHints?: ConfigUiHints;
  updateField: (name: string, value: unknown) => void;
  disabled: boolean;
}) {
  return (
    <>
      {props.layoutBlocks.map((block, index) => {
        if (block.type === 'fields') {
          const blockFields = resolveFieldsForSection(props.fields, block.section);
          if (blockFields.length === 0) {
            return null;
          }
          const content = (
            <ChannelFormFieldsSection
              channelName={props.channelName}
              fields={blockFields}
              formData={props.formData}
              jsonDrafts={props.jsonDrafts}
              setJsonDrafts={props.setJsonDrafts}
              updateField={props.updateField}
              uiHints={props.uiHints}
            />
          );
          if (!block.collapsible) {
            return <div key={`${block.type}-${block.section}-${index}`}>{content}</div>;
          }
          return (
            <details key={`${block.type}-${block.section}-${index}`} className="group rounded-2xl border border-gray-200/80 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-gray-900">
                <div>
                  <p>{block.collapsible.title}</p>
                  {block.collapsible.description ? <p className="mt-1 text-xs font-normal text-gray-500">{block.collapsible.description}</p> : null}
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-6 border-t border-gray-100 px-5 py-5">{content}</div>
            </details>
          );
        }
        return block.sectionId === 'weixin-auth' ? (
          <WeixinChannelAuthSection
            key={`${block.type}-${block.sectionId}-${index}`}
            channelConfig={props.channelConfig}
            formData={props.formData}
            channelEnabled={props.enabled}
            disabled={props.disabled}
          />
        ) : null;
      })}
    </>
  );
}

function ChannelFormEditor(props: ChannelFormEditorProps) {
  const updateChannel = useUpdateChannel();
  const executeAction = useExecuteConfigAction();
  const [formData, setFormData] = useState<Record<string, unknown>>(() => ({ ...props.channelConfig }));
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>(() => buildJsonDrafts(props.channelConfig, props.fields));
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const channelApplyStatus = buildChannelApplyStatusView(useChannelApplyState(props.channelName));
  const enabled = typeof formData.enabled === 'boolean' ? formData.enabled : Boolean(props.channelConfig.enabled);
  const disabled = updateChannel.isPending || Boolean(runningActionId);

  const updateField = (name: string, value: unknown) => setFormData((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const payload: Record<string, unknown> = { ...formData };
    for (const field of props.fields) {
      if (field.type === 'password') {
        const value = payload[field.name];
        if (typeof value !== 'string' || value.length === 0) {
          delete payload[field.name];
        }
      }
      if (field.type === 'json') {
        try {
          payload[field.name] = (jsonDrafts[field.name] ?? '').trim() ? JSON.parse(jsonDrafts[field.name]) : {};
        } catch {
          toast.error(`${t('invalidJson')}: ${field.name}`);
          return;
        }
      }
    }
    updateChannel.mutate({ channel: props.channelName, data: payload });
  };

  const applyActionPatchToForm = (patch?: Record<string, unknown>) => {
    if (!isRecord(patch?.channels) || !isRecord(patch.channels[props.channelName])) {
      return;
    }
    const channelPatch = patch.channels[props.channelName] as Record<string, unknown>;
    setFormData((prev) => deepMergeRecords(prev, channelPatch));
    setJsonDrafts((prev) => {
      const nextDrafts = { ...prev };
      let changed = false;
      for (const field of props.fields) {
        if (field.type !== 'json' || !Object.prototype.hasOwnProperty.call(channelPatch, field.name)) {
          continue;
        }
        nextDrafts[field.name] = JSON.stringify(channelPatch[field.name] ?? {}, null, 2);
        changed = true;
      }
      return changed ? nextDrafts : prev;
    });
  };

  const handleManualAction = async (action: ConfigActionManifest) => {
    setRunningActionId(action.id);
    try {
      const scope = `channels.${props.channelName}`;
      let nextData = { ...formData };
      if (action.saveBeforeRun) {
        nextData = { ...nextData, ...(action.savePatch ?? {}) };
        setFormData(nextData);
        await updateChannel.mutateAsync({ channel: props.channelName, data: nextData });
      }
      const result = await executeAction.mutateAsync({ actionId: action.id, data: { scope, draftConfig: buildScopeDraft(scope, nextData) } });
      applyActionPatchToForm(result.patch);
      result.ok ? toast.success(result.message || t('success')) : toast.error(result.message || t('error'));
    } catch (error) {
      toast.error(`${t('error')}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRunningActionId(null);
    }
  };

  return (
    <ConfigSplitDetailPane>
      <ChannelFormHeader
        channelName={props.channelName}
        channelLabel={props.channelLabel}
        enabled={enabled}
        tutorialUrl={props.tutorialUrl}
        channelApplyStatus={channelApplyStatus}
      />

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ConfigSplitPaneBody className="space-y-6 px-6 py-5">
          <ChannelFormBlocks
            channelConfig={props.channelConfig}
            channelName={props.channelName}
            enabled={enabled}
            fields={props.fields}
            formData={formData}
            jsonDrafts={jsonDrafts}
            layoutBlocks={props.layoutBlocks}
            setJsonDrafts={setJsonDrafts}
            uiHints={props.uiHints}
            updateField={updateField}
            disabled={disabled}
          />
        </ConfigSplitPaneBody>

        <ConfigSplitPaneFooter className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {props.actions.filter((action) => action.trigger === 'manual').map((action) => (
              <Button key={action.id} type="button" onClick={() => void handleManualAction(action)} disabled={disabled} variant="secondary">
                {runningActionId === action.id ? t('connecting') : action.title}
              </Button>
            ))}
          </div>
          <Button type="submit" disabled={disabled}>
            {updateChannel.isPending ? t('saving') : t('save')}
          </Button>
        </ConfigSplitPaneFooter>
      </form>
    </ConfigSplitDetailPane>
  );
}

export function ChannelForm({ channelName }: ChannelFormProps) {
  const { data: config } = useConfig();
  const { data: meta } = useConfigMeta();
  const { data: schema } = useConfigSchema();
  const channelConfig = channelName ? config?.channels[channelName] ?? null : null;
  const channelMeta = meta?.channels.find((item) => item.name === channelName);
  const channelDefinition = useMemo(() => buildChannelFormDefinitions()[channelName || ''], [channelName]);

  if (!channelName || !channelMeta || !channelConfig) {
    return (
      <ConfigSplitEmptyPane>
        <div>
          <h3 className="text-base font-semibold text-gray-900">{t('channelsSelectTitle')}</h3>
          <p className="mt-2 text-sm text-gray-500">{t('channelsSelectDescription')}</p>
        </div>
      </ConfigSplitEmptyPane>
    );
  }

  const fields = channelDefinition?.fields ?? EMPTY_CHANNEL_FIELDS;
  const layoutBlocks = channelDefinition?.layout ?? DEFAULT_CHANNEL_LAYOUT_BLOCKS;
  const uiHints = schema?.uiHints;
  const channelLabel = hintForPath(`channels.${channelName}`, uiHints)?.label ?? channelName;
  const tutorialUrl = resolveChannelTutorialUrl(channelMeta);
  const formKey = JSON.stringify({ channelName, channelConfig, jsonFields: fields.filter((field) => field.type === 'json').map((field) => field.name) });
  const actions = schema?.actions?.filter((action) => action.scope === `channels.${channelName}`) ?? [];

  return (
    <ChannelFormEditor
      key={formKey}
      actions={actions}
      channelConfig={channelConfig}
      channelLabel={channelLabel}
      channelName={channelName}
      fields={fields}
      layoutBlocks={layoutBlocks}
      tutorialUrl={tutorialUrl}
      uiHints={uiHints}
    />
  );
}
