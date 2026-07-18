import { useMemo, useState, useSyncExternalStore } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { eventKeys } from '@nextclaw/shared';
import { BookOpen, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { LogoBadge } from '@/shared/components/common/logo-badge';
import { NavigationLink } from '@/shared/components/actions/navigation-link';
import { Button } from '@/shared/components/ui/button';
import { FormActions } from '@/shared/components/ui/actions/form-actions';
import { StatusDot } from '@/shared/components/status/status-dot';
import { nextclawClient } from '@/shared/lib/api';
import { useConfig, useConfigMeta, useConfigSchema, useExecuteConfigAction, useUpdateChannel } from '@/shared/hooks/use-config';
import type { ConfigActionManifest, ConfigUiHints } from '@/shared/lib/api';
import { ChannelFormFieldsSection } from '@/features/channels/components/channel-form-fields-section';
import { FeishuChannelAuthSection, QrChannelAuthSection } from '@/features/channels/components/config/weixin-channel-auth-section';
import { buildChannelFormDefinitions, type ChannelField, type ChannelFormBlock, type ChannelFormFieldSection } from '@/features/channels/utils/channel-form-fields.utils';
import { ConfigSplitDetailPane, ConfigSplitEmptyPane, ConfigSplitPaneBody, ConfigSplitPaneFooter, ConfigSplitPaneHeader } from '@/shared/components/config-split-page';
import { hintForPath } from '@/shared/lib/config-hints';
import { resolveChannelTutorialUrl } from '@/features/channels/utils/channel-tutorials.utils';
import { t } from '@/shared/lib/i18n';
import { getChannelLogo } from '@/shared/lib/logos';
import { cn } from '@/shared/lib/utils';

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
  channelApplyUnsubscribe = nextclawClient.eventBus.on(eventKeys.channelConfigApplyStatus, (payload) => {
    channelApplySnapshots.set(
      payload.channel,
      payload.status === 'started'
        ? { status: 'applying' }
        : payload.status === 'succeeded'
          ? { status: 'applied' }
          : { status: 'failed', message: payload.message }
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

function ChannelFormHeader({
  channelApplyStatus,
  channelLabel,
  channelName,
  enabled,
  tutorialUrl
}: {
  channelApplyStatus: ReturnType<typeof buildChannelApplyStatusView>;
  channelLabel?: string;
  channelName: string;
  enabled: boolean;
  tutorialUrl?: string;
}) {
  return (
    <ConfigSplitPaneHeader className='px-5 py-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='min-w-0'>
          <div className='flex items-center gap-3'>
            <LogoBadge
              name={channelName}
              src={getChannelLogo(channelName)}
              className={cn('h-9 w-9 rounded-lg bg-background/80', enabled && 'ring-1 ring-primary/20')}
              imgClassName='h-5 w-5 object-contain'
              fallback={<span className='text-sm font-semibold uppercase text-muted-foreground'>{channelName[0]}</span>}
            />
            <h3 className='truncate text-lg font-semibold text-foreground capitalize'>{channelLabel}</h3>
          </div>
          <p className='mt-2 text-sm text-muted-foreground'>{t('channelsFormDescription')}</p>
          {channelApplyStatus ? <p className={cn('mt-2 text-xs font-medium', channelApplyStatus.className)}>{channelApplyStatus.label}</p> : null}
          {tutorialUrl ? (
            <NavigationLink href={tutorialUrl} external icon={BookOpen} size='xs' className='mt-2'>
              {t('channelsGuideTitle')}
            </NavigationLink>
          ) : null}
        </div>
        <StatusDot status={enabled ? 'active' : 'inactive'} label={enabled ? t('statusActive') : t('statusInactive')} />
      </div>
    </ConfigSplitPaneHeader>
  );
}

function ChannelFormBlocks({
  channelConfig,
  channelName,
  disabled,
  enabled,
  fields,
  formData,
  jsonDrafts,
  layoutBlocks,
  setJsonDrafts,
  uiHints,
  updateField
}: {
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
      {layoutBlocks.map((block, index) => {
        if (block.type === 'fields') {
          const blockFields = resolveFieldsForSection(fields, block.section);
          if (blockFields.length === 0) {
            return null;
          }
          const content = (
            <ChannelFormFieldsSection
              channelName={channelName}
              fields={blockFields}
              formData={formData}
              jsonDrafts={jsonDrafts}
              setJsonDrafts={setJsonDrafts}
              updateField={updateField}
              uiHints={uiHints}
            />
          );
          if (!block.collapsible) {
            return <div key={`${block.type}-${block.section}-${index}`}>{content}</div>;
          }
          return (
            <details key={`${block.type}-${block.section}-${index}`} className='group rounded-xl bg-muted/35'>
              <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground'>
                <div>
                  <p>{block.collapsible.title}</p>
                  {block.collapsible.description ? <p className='mt-1 text-xs font-normal text-muted-foreground'>{block.collapsible.description}</p> : null}
                </div>
                <ChevronDown className='h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180' />
              </summary>
              <div className='space-y-5 border-t border-border/45 px-4 py-4'>{content}</div>
            </details>
          );
        }
        if (block.sectionId === 'feishu-auth') {
          return (
            <FeishuChannelAuthSection
              key={`${block.type}-${block.sectionId}-${index}`}
              channelConfig={channelConfig}
              formData={formData}
              channelEnabled={enabled}
              disabled={disabled}
            />
          );
        }
        return block.sectionId === 'weixin-auth' ? (
          <QrChannelAuthSection
            key={`${block.type}-${block.sectionId}-${index}`}
            channelConfig={channelConfig}
            formData={formData}
            channelName='weixin'
            channelEnabled={enabled}
            disabled={disabled}
          />
        ) : null;
      })}
    </>
  );
}

function ChannelFormEditor({
  actions,
  channelConfig,
  channelLabel,
  channelName,
  fields,
  layoutBlocks,
  tutorialUrl,
  uiHints
}: ChannelFormEditorProps) {
  const updateChannel = useUpdateChannel();
  const executeAction = useExecuteConfigAction();
  const [formData, setFormData] = useState<Record<string, unknown>>(() => ({ ...channelConfig }));
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>(() => buildJsonDrafts(channelConfig, fields));
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const channelApplyStatus = buildChannelApplyStatusView(useChannelApplyState(channelName));
  const enabled = typeof formData.enabled === 'boolean' ? formData.enabled : Boolean(channelConfig.enabled);
  const disabled = updateChannel.isPending || Boolean(runningActionId);

  const updateField = (name: string, value: unknown) => setFormData((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const payload: Record<string, unknown> = { ...formData };
    for (const field of fields) {
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
    updateChannel.mutate({ channel: channelName, data: payload });
  };

  const applyActionPatchToForm = (patch?: Record<string, unknown>) => {
    if (!isRecord(patch?.channels) || !isRecord(patch.channels[channelName])) {
      return;
    }
    const channelPatch = patch.channels[channelName] as Record<string, unknown>;
    setFormData((prev) => deepMergeRecords(prev, channelPatch));
    setJsonDrafts((prev) => {
      const nextDrafts = { ...prev };
      let changed = false;
      for (const field of fields) {
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
      const scope = `channels.${channelName}`;
      let nextData = { ...formData };
      if (action.saveBeforeRun) {
        nextData = { ...nextData, ...(action.savePatch ?? {}) };
        setFormData(nextData);
        await updateChannel.mutateAsync({ channel: channelName, data: nextData });
      }
      const result = await executeAction.mutateAsync({ actionId: action.id, data: { scope, draftConfig: buildScopeDraft(scope, nextData) } });
      applyActionPatchToForm(result.patch);
      if (result.ok) {
        toast.success(result.message || t('success'));
      } else {
        toast.error(result.message || t('error'));
      }
    } catch (error) {
      toast.error(`${t('error')}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRunningActionId(null);
    }
  };

  return (
    <ConfigSplitDetailPane>
      <ChannelFormHeader
        channelName={channelName}
        channelLabel={channelLabel}
        enabled={enabled}
        tutorialUrl={tutorialUrl}
        channelApplyStatus={channelApplyStatus}
      />

      <form onSubmit={handleSubmit} className='flex min-h-0 flex-1 flex-col'>
        <ConfigSplitPaneBody className='space-y-5 px-5 py-4'>
          <ChannelFormBlocks
            channelConfig={channelConfig}
            channelName={channelName}
            enabled={enabled}
            fields={fields}
            formData={formData}
            jsonDrafts={jsonDrafts}
            layoutBlocks={layoutBlocks}
            setJsonDrafts={setJsonDrafts}
            uiHints={uiHints}
            updateField={updateField}
            disabled={disabled}
          />
        </ConfigSplitPaneBody>

        <ConfigSplitPaneFooter>
          <FormActions align='between'>
            <div className='flex flex-wrap items-center gap-2'>
              {actions.filter((action) => action.trigger === 'manual').map((action) => (
                <Button key={action.id} type='button' size='sm' onClick={() => void handleManualAction(action)} disabled={disabled} variant='secondary'>
                  {runningActionId === action.id ? t('connecting') : action.title}
                </Button>
              ))}
            </div>
            <Button type='submit' size='sm' disabled={disabled}>
              {updateChannel.isPending ? t('saving') : t('save')}
            </Button>
          </FormActions>
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
          <h3 className='text-base font-semibold text-foreground'>{t('channelsSelectTitle')}</h3>
          <p className='mt-2 text-sm text-muted-foreground'>{t('channelsSelectDescription')}</p>
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
