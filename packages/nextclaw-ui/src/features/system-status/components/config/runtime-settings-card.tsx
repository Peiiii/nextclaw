import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { SettingRow, SettingsGroup, SettingsSection } from '@/shared/components/settings/setting-row';
import { Switch } from '@/shared/components/ui/switch';
import { t } from '@/shared/lib/i18n';
import type { DmScope } from '@/features/system-status/utils/runtime-config-agent.utils';

const DM_SCOPE_OPTIONS: Array<{ value: DmScope; labelKey: string }> = [
  { value: 'main', labelKey: 'dmScopeMain' },
  { value: 'per-peer', labelKey: 'dmScopePerPeer' },
  { value: 'per-channel-peer', labelKey: 'dmScopePerChannelPeer' },
  {
    value: 'per-account-channel-peer',
    labelKey: 'dmScopePerAccountChannelPeer'
  }
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
    <SettingsSection title={t('dmScope')} description={t('dmScopeHelp')}>
      <SettingsGroup>
        <SettingRow
          title={t('runtimeCompanionEnabled')}
          description={t('runtimeCompanionEnabledHelp')}
          control={<Switch checked={companionEnabled} onCheckedChange={onCompanionEnabledChange} />}
        />
        <SettingRow
          title={t('defaultContextTokens')}
          description={t('defaultContextTokensHelp')}
          control={
            <Input
              type='number'
              min={1000}
              step={1000}
              value={defaultContextTokens}
              onChange={(event) =>
                onDefaultContextTokensChange(Math.max(1000, Number.parseInt(event.target.value, 10) || 1000))
              }
              className='w-36'
            />
          }
        />
        <SettingRow
          title={t('defaultEngine')}
          description={t('defaultEngineHelp')}
          control={
            <Input
              value={defaultEngine}
              onChange={(event) => onDefaultEngineChange(event.target.value)}
              placeholder={t('defaultEnginePlaceholder')}
              className='w-56'
            />
          }
        />
        <SettingRow
          title={t('dmScope')}
          control={
            <Select value={dmScope} onValueChange={(value) => onDmScopeChange(value as DmScope)}>
              <SelectTrigger className='w-56'>
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
          }
        />
      </SettingsGroup>
    </SettingsSection>
  );
}
