import { useEffect, useMemo, useState } from 'react';
import { useConfig, useConfigMeta, useConfigSchema, useUpdateChannel, useExecuteConfigAction } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { StatusDot } from '@/components/ui/status-dot';
import { LogoBadge } from '@/components/common/LogoBadge';
import { t } from '@/lib/i18n';
import { hintForPath } from '@/lib/config-hints';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { BookOpen, ChevronDown } from 'lucide-react';
import type { ConfigActionManifest } from '@/api/types';
import { resolveChannelTutorialUrl } from '@/lib/channel-tutorials';
import { getChannelLogo } from '@/lib/logos';
import { CONFIG_DETAIL_CARD_CLASS, CONFIG_EMPTY_DETAIL_CARD_CLASS } from './config-layout';
import { ChannelFormFieldsSection } from './channel-form-fields-section';
import { buildChannelFormDefinitions, type ChannelField, type ChannelFormBlock, type ChannelFormFieldSection } from './channel-form-fields';
import { WeixinChannelAuthSection } from './weixin-channel-auth-section';

type ChannelFormProps = {
  channelName?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMergeRecords(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const prev = next[key];
    if (isRecord(prev) && isRecord(value)) {
      next[key] = deepMergeRecords(prev, value);
      continue;
    }
    next[key] = value;
  }
  return next;
}

function buildScopeDraft(scope: string, value: Record<string, unknown>): Record<string, unknown> {
  const segments = scope.split('.');
  const output: Record<string, unknown> = {};
  let cursor: Record<string, unknown> = output;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    cursor[segment] = {};
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]] = value;
  return output;
}

function resolveFieldsForSection(fields: ChannelField[], section: ChannelFormFieldSection): ChannelField[] {
  if (section === 'all') {
    return fields;
  }
  if (section === 'primary') {
    return fields.filter((field) => field.section === 'primary');
  }
  return fields.filter((field) => field.section !== 'primary');
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

  const channelConfig = channelName ? config?.channels[channelName] : null;
  const channelDefinitions = useMemo(() => buildChannelFormDefinitions(), []);
  const channelDefinition = channelName ? channelDefinitions[channelName] : undefined;
  const fields = channelDefinition?.fields ?? [];
  const layoutBlocks = channelDefinition?.layout ?? [{ type: 'fields', section: 'all' } satisfies ChannelFormBlock];
  const uiHints = schema?.uiHints;
  const scope = channelName ? `channels.${channelName}` : null;
  const actions = schema?.actions?.filter((action) => action.scope === scope) ?? [];
  const channelLabel = channelName
    ? hintForPath(`channels.${channelName}`, uiHints)?.label ?? channelName
    : channelName;
  const channelMeta = meta?.channels.find((item) => item.name === channelName);
  const tutorialUrl = channelMeta ? resolveChannelTutorialUrl(channelMeta) : undefined;

  useEffect(() => {
    if (channelConfig) {
      setFormData({ ...channelConfig });
      const nextDrafts: Record<string, string> = {};
      fields
        .filter((field) => field.type === 'json')
        .forEach((field) => {
          const value = channelConfig[field.name];
          nextDrafts[field.name] = JSON.stringify(value ?? {}, null, 2);
        });
      setJsonDrafts(nextDrafts);
    } else {
      setFormData({});
      setJsonDrafts({});
    }
  }, [channelConfig, fields]);

  const updateField = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!channelName) return;

    const payload: Record<string, unknown> = { ...formData };
    for (const field of fields) {
      if (field.type !== 'password') {
        continue;
      }
      const value = payload[field.name];
      if (typeof value !== 'string' || value.length === 0) {
        delete payload[field.name];
      }
    }
    for (const field of fields) {
      if (field.type !== 'json') {
        continue;
      }
      const raw = jsonDrafts[field.name] ?? '';
      try {
        payload[field.name] = raw.trim() ? JSON.parse(raw) : {};
      } catch {
        toast.error(`${t('invalidJson')}: ${field.name}`);
        return;
      }
    }

    updateChannel.mutate({ channel: channelName, data: payload });
  };

  const applyActionPatchToForm = (patch?: Record<string, unknown>) => {
    if (!patch || !channelName) {
      return;
    }
    const channelsNode = patch.channels;
    if (!isRecord(channelsNode)) {
      return;
    }
    const channelPatch = channelsNode[channelName];
    if (!isRecord(channelPatch)) {
      return;
    }
    setFormData((prev) => deepMergeRecords(prev, channelPatch));
  };

  const handleManualAction = async (action: ConfigActionManifest) => {
    if (!channelName || !scope) {
      return;
    }

    setRunningActionId(action.id);
    try {
      let nextData = { ...formData };

      if (action.saveBeforeRun) {
        nextData = {
          ...nextData,
          ...(action.savePatch ?? {})
        };
        setFormData(nextData);
        await updateChannel.mutateAsync({ channel: channelName, data: nextData });
      }

      const result = await executeAction.mutateAsync({
        actionId: action.id,
        data: {
          scope,
          draftConfig: buildScopeDraft(scope, nextData)
        }
      });

      applyActionPatchToForm(result.patch);

      if (result.ok) {
        toast.success(result.message || t('success'));
      } else {
        toast.error(result.message || t('error'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`${t('error')}: ${message}`);
    } finally {
      setRunningActionId(null);
    }
  };

  if (!channelName || !channelMeta || !channelConfig) {
    return (
      <div className={CONFIG_EMPTY_DETAIL_CARD_CLASS}>
        <div>
          <h3 className="text-base font-semibold text-gray-900">{t('channelsSelectTitle')}</h3>
          <p className="mt-2 text-sm text-gray-500">{t('channelsSelectDescription')}</p>
        </div>
      </div>
    );
  }

  const enabled = typeof formData.enabled === 'boolean' ? formData.enabled : Boolean(channelConfig.enabled);

  return (
    <div className={CONFIG_DETAIL_CARD_CLASS}>
      <div className="border-b border-gray-100 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <LogoBadge
                name={channelName}
                src={getChannelLogo(channelName)}
                className={cn(
                  'h-9 w-9 rounded-lg border',
                  enabled ? 'border-primary/30 bg-white' : 'border-gray-200/70 bg-white'
                )}
                imgClassName="h-5 w-5 object-contain"
                fallback={<span className="text-sm font-semibold uppercase text-gray-500">{channelName[0]}</span>}
              />
              <h3 className="truncate text-lg font-semibold text-gray-900 capitalize">{channelLabel}</h3>
            </div>
            <p className="mt-2 text-sm text-gray-500">{t('channelsFormDescription')}</p>
            {tutorialUrl && (
              <a
                href={tutorialUrl}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary transition-colors hover:text-primary-hover"
              >
                <BookOpen className="h-3.5 w-3.5" />
                {t('channelsGuideTitle')}
              </a>
            )}
          </div>
          <StatusDot status={enabled ? 'active' : 'inactive'} label={enabled ? t('statusActive') : t('statusInactive')} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
          {layoutBlocks.map((block, index) => {
            if (block.type === 'fields') {
              const blockFields = resolveFieldsForSection(fields, block.section);
              if (blockFields.length === 0) {
                return null;
              }
              if (!block.collapsible) {
                return (
                  <ChannelFormFieldsSection
                    key={`${block.type}-${block.section}-${index}`}
                    channelName={channelName}
                    fields={blockFields}
                    formData={formData}
                    jsonDrafts={jsonDrafts}
                    setJsonDrafts={setJsonDrafts}
                    updateField={updateField}
                    uiHints={uiHints}
                  />
                );
              }
              return (
                <details key={`${block.type}-${block.section}-${index}`} className="group rounded-2xl border border-gray-200/80 bg-white">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-gray-900">
                    <div>
                      <p>{block.collapsible.title}</p>
                      {block.collapsible.description ? (
                        <p className="mt-1 text-xs font-normal text-gray-500">{block.collapsible.description}</p>
                      ) : null}
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="space-y-6 border-t border-gray-100 px-5 py-5">
                    <ChannelFormFieldsSection
                      channelName={channelName}
                      fields={blockFields}
                      formData={formData}
                      jsonDrafts={jsonDrafts}
                      setJsonDrafts={setJsonDrafts}
                      updateField={updateField}
                      uiHints={uiHints}
                    />
                  </div>
                </details>
              );
            }

            if (block.sectionId === 'weixin-auth') {
              return (
                <WeixinChannelAuthSection
                  key={`${block.type}-${block.sectionId}-${index}`}
                  channelConfig={channelConfig}
                  formData={formData}
                  channelEnabled={enabled}
                  disabled={updateChannel.isPending || Boolean(runningActionId)}
                />
              );
            }

            return null;
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {actions
              .filter((action) => action.trigger === 'manual')
              .map((action) => (
                <Button
                  key={action.id}
                  type="button"
                  onClick={() => handleManualAction(action)}
                  disabled={updateChannel.isPending || Boolean(runningActionId)}
                  variant="secondary"
                >
                  {runningActionId === action.id ? t('connecting') : action.title}
                </Button>
              ))}
          </div>
          <Button type="submit" disabled={updateChannel.isPending || Boolean(runningActionId)}>
            {updateChannel.isPending ? t('saving') : t('save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
