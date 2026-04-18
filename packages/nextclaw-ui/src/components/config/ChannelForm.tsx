import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useConfig, useConfigMeta, useConfigSchema, useExecuteConfigAction, useUpdateChannel } from '@/hooks/useConfig';
import { LogoBadge } from '@/components/common/LogoBadge';
import { Button } from '@/components/ui/button';
import { StatusDot } from '@/components/ui/status-dot';
import type { ConfigActionManifest } from '@/api/types';
import { hintForPath } from '@/lib/config-hints';
import { resolveChannelTutorialUrl } from '@/lib/channel-tutorials';
import { t } from '@/lib/i18n';
import { getChannelLogo } from '@/lib/logos';
import { cn } from '@/lib/utils';
import { appClient } from '@/transport';
import {
  ConfigSplitDetailPane,
  ConfigSplitEmptyPane,
  ConfigSplitPaneBody,
  ConfigSplitPaneFooter,
  ConfigSplitPaneHeader
} from './config-split-page';
import { buildChannelFormDefinitions, type ChannelField, type ChannelFormBlock, type ChannelFormFieldSection } from './channel-form-fields';
import { ChannelFormFieldsSection } from './channel-form-fields-section';
import { WeixinChannelAuthSection } from './weixin-channel-auth-section';

type ChannelFormProps = { channelName?: string };
type ChannelApplyState = { status: 'applying' | 'applied' | 'failed'; message?: string } | null;
const EMPTY_CHANNEL_FIELDS: ChannelField[] = [];
const DEFAULT_CHANNEL_LAYOUT_BLOCKS: ChannelFormBlock[] = [{ type: 'fields', section: 'all' }];

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
  if (section === 'all') {
    return fields;
  }
  return fields.filter((field) => (section === 'primary' ? field.section === 'primary' : field.section !== 'primary'));
}

function buildJsonDrafts(channelConfig: Record<string, unknown>, fields: ChannelField[]) {
  const nextDrafts: Record<string, string> = {};
  fields.filter((field) => field.type === 'json').forEach((field) => {
    nextDrafts[field.name] = JSON.stringify(channelConfig[field.name] ?? {}, null, 2);
  });
  return nextDrafts;
}

function useChannelApplyState(channelName: string | undefined) {
  const [channelApplyState, setChannelApplyState] = useState<ChannelApplyState>(null);

  useEffect(() => {
    if (!channelName) {
      setChannelApplyState(null);
      return;
    }
    return appClient.subscribe((event) => {
      if (event.type !== 'channel.config.apply-status' || event.payload.channel !== channelName) {
        return;
      }
      setChannelApplyState(
        event.payload.status === 'started'
          ? { status: 'applying' }
          : event.payload.status === 'succeeded'
            ? { status: 'applied' }
            : { status: 'failed', message: event.payload.message }
      );
    });
  }, [channelName]);

  return channelApplyState;
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
  return {
    className: 'text-red-600',
    label: `${t('channelConfigApplyFailed')}${channelApplyState.message ? `: ${channelApplyState.message}` : ''}`
  };
}

export function ChannelForm({ channelName }: ChannelFormProps) {
  const { data: config } = useConfig();
  const { data: meta } = useConfigMeta();
  const { data: schema } = useConfigSchema();
  const updateChannel = useUpdateChannel();
  const executeAction = useExecuteConfigAction();
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>({});
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const channelApplyState = useChannelApplyState(channelName);
  const lastHydrationKeyRef = useRef<string | null>(null);

  const channelConfig = channelName ? config?.channels[channelName] : null;
  const channelDefinition = useMemo(() => buildChannelFormDefinitions()[channelName || ''], [channelName]);
  const fields = channelDefinition?.fields ?? EMPTY_CHANNEL_FIELDS;
  const layoutBlocks = channelDefinition?.layout ?? DEFAULT_CHANNEL_LAYOUT_BLOCKS;
  const uiHints = schema?.uiHints;
  const scope = channelName ? `channels.${channelName}` : null;
  const actions = schema?.actions?.filter((action) => action.scope === scope) ?? [];
  const channelMeta = meta?.channels.find((item) => item.name === channelName);
  const channelLabel = channelName ? hintForPath(`channels.${channelName}`, uiHints)?.label ?? channelName : channelName;
  const tutorialUrl = channelMeta ? resolveChannelTutorialUrl(channelMeta) : undefined;
  const hydrationKey = channelName && channelConfig
    ? JSON.stringify({ channelName, channelConfig, jsonFields: fields.filter((field) => field.type === 'json').map((field) => field.name) })
    : `empty:${channelName ?? ''}`;

  useEffect(() => {
    if (lastHydrationKeyRef.current === hydrationKey) {
      return;
    }
    lastHydrationKeyRef.current = hydrationKey;
    if (channelConfig) {
      setFormData({ ...channelConfig });
      setJsonDrafts(buildJsonDrafts(channelConfig, fields));
      return;
    }
    setFormData({});
    setJsonDrafts({});
  }, [channelConfig, fields, hydrationKey]);

  const updateField = (name: string, value: unknown) => setFormData((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName) {
      return;
    }

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
    if (!patch || !channelName || !isRecord(patch.channels) || !isRecord(patch.channels[channelName])) {
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
    if (!channelName || !scope) {
      return;
    }

    setRunningActionId(action.id);
    try {
      let nextData = { ...formData };
      if (action.saveBeforeRun) {
        nextData = { ...nextData, ...(action.savePatch ?? {}) };
        setFormData(nextData);
        await updateChannel.mutateAsync({ channel: channelName, data: nextData });
      }
      const result = await executeAction.mutateAsync({
        actionId: action.id,
        data: { scope, draftConfig: buildScopeDraft(scope, nextData) }
      });
      applyActionPatchToForm(result.patch);
      result.ok ? toast.success(result.message || t('success')) : toast.error(result.message || t('error'));
    } catch (error) {
      toast.error(`${t('error')}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRunningActionId(null);
    }
  };

  if (!channelName || !channelMeta || !channelConfig) {
    return (
      <ConfigSplitEmptyPane>
        <div>
          <h3 className='text-base font-semibold text-gray-900'>{t('channelsSelectTitle')}</h3>
          <p className='mt-2 text-sm text-gray-500'>{t('channelsSelectDescription')}</p>
        </div>
      </ConfigSplitEmptyPane>
    );
  }

  const enabled = typeof formData.enabled === 'boolean' ? formData.enabled : Boolean(channelConfig.enabled);
  const channelApplyStatus = buildChannelApplyStatusView(channelApplyState);

  return (
    <ConfigSplitDetailPane>
      <ConfigSplitPaneHeader className='px-6 py-5'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='min-w-0'>
            <div className='flex items-center gap-3'>
              <LogoBadge
                name={channelName}
                src={getChannelLogo(channelName)}
                className={cn('h-9 w-9 rounded-lg border', enabled ? 'border-primary/30 bg-white' : 'border-gray-200/70 bg-white')}
                imgClassName='h-5 w-5 object-contain'
                fallback={<span className='text-sm font-semibold uppercase text-gray-500'>{channelName[0]}</span>}
              />
              <h3 className='truncate text-lg font-semibold text-gray-900 capitalize'>{channelLabel}</h3>
            </div>
            <p className='mt-2 text-sm text-gray-500'>{t('channelsFormDescription')}</p>
            {channelApplyStatus ? <p className={cn('mt-2 text-xs font-medium', channelApplyStatus.className)}>{channelApplyStatus.label}</p> : null}
            {tutorialUrl ? (
              <a href={tutorialUrl} className='mt-2 inline-flex items-center gap-1.5 text-xs text-primary transition-colors hover:text-primary-hover'>
                <BookOpen className='h-3.5 w-3.5' />
                {t('channelsGuideTitle')}
              </a>
            ) : null}
          </div>
          <StatusDot status={enabled ? 'active' : 'inactive'} label={enabled ? t('statusActive') : t('statusInactive')} />
        </div>
      </ConfigSplitPaneHeader>

      <form onSubmit={handleSubmit} className='flex min-h-0 flex-1 flex-col'>
        <ConfigSplitPaneBody className='space-y-6 px-6 py-5'>
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
                <details key={`${block.type}-${block.section}-${index}`} className='group rounded-2xl border border-gray-200/80 bg-white'>
                  <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-gray-900'>
                    <div>
                      <p>{block.collapsible.title}</p>
                      {block.collapsible.description ? <p className='mt-1 text-xs font-normal text-gray-500'>{block.collapsible.description}</p> : null}
                    </div>
                    <ChevronDown className='h-4 w-4 text-gray-400 transition-transform group-open:rotate-180' />
                  </summary>
                  <div className='space-y-6 border-t border-gray-100 px-5 py-5'>{content}</div>
                </details>
              );
            }
            return block.sectionId === 'weixin-auth' ? (
              <WeixinChannelAuthSection
                key={`${block.type}-${block.sectionId}-${index}`}
                channelConfig={channelConfig}
                formData={formData}
                channelEnabled={enabled}
                disabled={updateChannel.isPending || Boolean(runningActionId)}
              />
            ) : null;
          })}
        </ConfigSplitPaneBody>

        <ConfigSplitPaneFooter className='flex flex-wrap items-center justify-between gap-3 px-6 py-4'>
          <div className='flex flex-wrap items-center gap-2'>
            {actions
              .filter((action) => action.trigger === 'manual')
              .map((action) => (
                <Button
                  key={action.id}
                  type='button'
                  onClick={() => handleManualAction(action)}
                  disabled={updateChannel.isPending || Boolean(runningActionId)}
                  variant='secondary'
                >
                  {runningActionId === action.id ? t('connecting') : action.title}
                </Button>
              ))}
          </div>
          <Button type='submit' disabled={updateChannel.isPending || Boolean(runningActionId)}>
            {updateChannel.isPending ? t('saving') : t('save')}
          </Button>
        </ConfigSplitPaneFooter>
      </form>
    </ConfigSplitDetailPane>
  );
}
