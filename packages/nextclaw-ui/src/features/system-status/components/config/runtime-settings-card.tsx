import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { t } from '@/shared/lib/i18n';
import type { DmScope } from '@/features/system-status/utils/runtime-config-agent.utils';

const DM_SCOPE_OPTIONS: Array<{ value: DmScope; label: string }> = [
  { value: 'main', label: 'main' },
  { value: 'per-peer', label: 'per-peer' },
  { value: 'per-channel-peer', label: 'per-channel-peer' },
  { value: 'per-account-channel-peer', label: 'per-account-channel-peer' }
];

export function RuntimeSettingsCard(props: {
  dmScope: DmScope;
  defaultContextTokens: number;
  defaultEngine: string;
  onDmScopeChange: (value: DmScope) => void;
  onDefaultContextTokensChange: (value: number) => void;
  onDefaultEngineChange: (value: string) => void;
  dmScopeLabel?: string;
  dmScopeHelp?: string;
  defaultContextTokensLabel?: string;
  defaultContextTokensHelp?: string;
  defaultEngineLabel?: string;
  defaultEngineHelp?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.dmScopeLabel ?? t('dmScope')}</CardTitle>
        <CardDescription>{props.dmScopeHelp ?? t('dmScopeHelp')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-800">{props.defaultContextTokensLabel ?? t('defaultContextTokens')}</label>
          <Input
            type="number"
            min={1000}
            step={1000}
            value={props.defaultContextTokens}
            onChange={(event) => props.onDefaultContextTokensChange(Math.max(1000, Number.parseInt(event.target.value, 10) || 1000))}
          />
          <p className="text-xs text-gray-500">{props.defaultContextTokensHelp ?? t('defaultContextTokensHelp')}</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-800">{props.defaultEngineLabel ?? t('defaultEngine')}</label>
          <Input
            value={props.defaultEngine}
            onChange={(event) => props.onDefaultEngineChange(event.target.value)}
            placeholder={t('defaultEnginePlaceholder')}
          />
          <p className="text-xs text-gray-500">{props.defaultEngineHelp ?? t('defaultEngineHelp')}</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-800">{props.dmScopeLabel ?? t('dmScope')}</label>
          <Select value={props.dmScope} onValueChange={(value) => props.onDmScopeChange(value as DmScope)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DM_SCOPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
