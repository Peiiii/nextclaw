import { KeyValueEditor } from '@/components/common/KeyValueEditor';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { t } from '@/lib/i18n';
import { ChevronDown, Settings2 } from 'lucide-react';
import { ProviderPillSelector } from './provider-pill-selector';

type WireApiType = 'auto' | 'chat' | 'responses';
type ProviderAdvancedSettingsSectionProps = { showAdvanced: boolean; onShowAdvancedChange: (value: boolean) => void; supportsWireApi: boolean; wireApiLabel: string; wireApi: WireApiType; onWireApiChange: (value: WireApiType) => void; shouldUseWireApiPills: boolean; wireApiSelectOptions: Array<{ value: string; label: string }>; extraHeadersLabel: string; extraHeaders: Record<string, string> | null; onExtraHeadersChange: (value: Record<string, string> | null) => void };

export function ProviderAdvancedSettingsSection(props: ProviderAdvancedSettingsSectionProps) {
  const {
    showAdvanced,
    onShowAdvancedChange,
    supportsWireApi,
    wireApiLabel,
    wireApi,
    onWireApiChange,
    shouldUseWireApiPills,
    wireApiSelectOptions,
    extraHeadersLabel,
    extraHeaders,
    onExtraHeadersChange
  } = props;

  return (
    <div className="border-t border-gray-100 pt-4">
      <button
        type="button"
        onClick={() => onShowAdvancedChange(!showAdvanced)}
        className="flex w-full items-center justify-between text-sm text-gray-600 transition-colors hover:text-gray-900"
      >
        <span className="flex items-center gap-1.5">
          <Settings2 className="h-3.5 w-3.5" />
          {t('providerAdvancedSettings')}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
      </button>

      {showAdvanced ? (
        <div className="mt-4 space-y-5">
          {supportsWireApi ? (
            <div className="space-y-2">
              <Label htmlFor="wireApi" className="text-sm font-medium text-gray-900">
                {wireApiLabel}
              </Label>
              {shouldUseWireApiPills ? (
                <ProviderPillSelector
                  value={wireApi}
                  onChange={(value) => onWireApiChange(value as WireApiType)}
                  options={wireApiSelectOptions}
                />
              ) : (
                <Select value={wireApi} onValueChange={(value) => onWireApiChange(value as WireApiType)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {wireApiSelectOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-900">{extraHeadersLabel}</Label>
            <KeyValueEditor value={extraHeaders} onChange={onExtraHeadersChange} />
            <p className="text-xs text-gray-500">{t('providerExtraHeadersHelpShort')}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
