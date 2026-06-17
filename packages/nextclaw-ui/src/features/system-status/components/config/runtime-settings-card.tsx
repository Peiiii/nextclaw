import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Switch } from '@/shared/components/ui/switch';
import { t } from '@/shared/lib/i18n';
import type { DmScope } from '@/features/system-status/utils/runtime-config-agent.utils';

const DM_SCOPE_OPTIONS: Array<{ value: DmScope; labelKey: string }> = [
  { value: 'main', labelKey: 'dmScopeMain' },
  { value: 'per-peer', labelKey: 'dmScopePerPeer' },
  { value: 'per-channel-peer', labelKey: 'dmScopePerChannelPeer' },
  { value: 'per-account-channel-peer', labelKey: 'dmScopePerAccountChannelPeer' }
];

export function RuntimeSettingsCard({
  companionEnabled,
  defaultContextTokens,
  defaultEngine,
  dmScope,
  onCompanionEnabledChange,
  onDefaultContextTokensChange,
  onDefaultEngineChange,
  onDmScopeChange
}: {
  dmScope: DmScope;
  companionEnabled: boolean;
  defaultContextTokens: number;
  defaultEngine: string;
  onCompanionEnabledChange: (value: boolean) => void;
  onDmScopeChange: (value: DmScope) => void;
  onDefaultContextTokensChange: (value: number) => void;
  onDefaultEngineChange: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dmScope')}</CardTitle>
        <CardDescription>{t('dmScopeHelp')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-md border border-gray-200 px-4 py-3">
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-800">{t('runtimeCompanionEnabled')}</div>
            <p className="text-xs text-gray-500">{t('runtimeCompanionEnabledHelp')}</p>
          </div>
          <Switch checked={companionEnabled} onCheckedChange={onCompanionEnabledChange} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-800">{t('defaultContextTokens')}</label>
          <Input
            type="number"
            min={1000}
            step={1000}
            value={defaultContextTokens}
            onChange={(event) => onDefaultContextTokensChange(Math.max(1000, Number.parseInt(event.target.value, 10) || 1000))}
          />
          <p className="text-xs text-gray-500">{t('defaultContextTokensHelp')}</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-800">{t('defaultEngine')}</label>
          <Input
            value={defaultEngine}
            onChange={(event) => onDefaultEngineChange(event.target.value)}
            placeholder={t('defaultEnginePlaceholder')}
          />
          <p className="text-xs text-gray-500">{t('defaultEngineHelp')}</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-800">{t('dmScope')}</label>
          <Select value={dmScope} onValueChange={(value) => onDmScopeChange(value as DmScope)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DM_SCOPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
