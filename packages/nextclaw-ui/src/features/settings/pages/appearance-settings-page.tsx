import type { ChatMessageLayout } from '@nextclaw/agent-chat-ui';
import { Check, Wand2 } from 'lucide-react';
import { useTheme } from '@/app/components/theme-provider';
import { useChatMessageLayoutStore } from '@/features/chat';
import { PRESET_BACKGROUNDS, useThemeManagerStore } from '@/features/theme-manager';
import { useLanguagePreference } from '@/features/settings/hooks/use-language-preference';
import { SettingRow, SettingsGroup, SettingsSection } from '@/shared/components/settings/setting-row';
import { SettingsPage } from '@/shared/components/settings/settings-page';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useI18n } from '@/app/components/i18n-provider';
import { t } from '@/shared/lib/i18n';
import { THEME_OPTIONS, type UiTheme } from '@/shared/lib/theme';
import { cn } from '@/shared/lib/utils';

const CHAT_MESSAGE_LAYOUT_OPTIONS: Array<{
  value: ChatMessageLayout;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: 'card',
    labelKey: 'chatMessageLayoutCard',
    descriptionKey: 'chatMessageLayoutCardDescription'
  },
  {
    value: 'flat',
    labelKey: 'chatMessageLayoutFlat',
    descriptionKey: 'chatMessageLayoutFlatDescription'
  }
];

export function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme();
  const { currentLanguage, languageOptions, selectLanguage } = useLanguagePreference();
  const { t: translate } = useI18n();
  const messageLayout = useChatMessageLayoutStore((state) => state.layout);
  const setMessageLayout = useChatMessageLayoutStore((state) => state.setLayout);
  const { currentBackground, setCurrentBackground } = useThemeManagerStore();

  return (
    <SettingsPage title={t('appearance')}>
      <SettingsSection>
        <SettingsGroup>
          <SettingRow
            title={t('theme')}
            control={
              <Select value={theme} onValueChange={(value) => setTheme(value as UiTheme)}>
                <SelectTrigger aria-label={t('theme')} className='w-36 sm:w-44'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THEME_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
          <SettingRow
            title={t('language')}
            control={
              <Select
                value={currentLanguage}
                onValueChange={(value) => selectLanguage(value as typeof currentLanguage)}
              >
                <SelectTrigger aria-label={t('language')} className='w-36 sm:w-44'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
          <SettingRow
            title={t('chatMessageLayoutTitle')}
            description={t('chatMessageLayoutDescription')}
            layout='stacked'
          >
            <div
              role='radiogroup'
              aria-label={t('chatMessageLayoutTitle')}
              className='grid gap-1 rounded-xl bg-background/65 p-1 sm:grid-cols-2'
            >
              {CHAT_MESSAGE_LAYOUT_OPTIONS.map((option) => {
                const selected = option.value === messageLayout;
                return (
                  <button
                    key={option.value}
                    type='button'
                    role='radio'
                    aria-checked={selected}
                    onClick={() => setMessageLayout(option.value)}
                    className={cn(
                      'flex min-w-0 items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                      selected
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1',
                        selected ? 'bg-primary text-primary-foreground ring-primary' : 'bg-background ring-border'
                      )}
                    >
                      {selected ? <Check className='h-2.5 w-2.5' strokeWidth={3} /> : null}
                    </span>
                    <span className='min-w-0'>
                      <span className='block text-sm font-medium'>{t(option.labelKey)}</span>
                      <span className='mt-1 block text-xs leading-5 text-muted-foreground'>
                        {t(option.descriptionKey)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </SettingRow>
          <SettingRow
            title={t('backgroundImageTitle')}
            description={t('backgroundImageDescription')}
            control={
              <Select
                value={currentBackground.id}
                onValueChange={(value) => {
                  const bg = PRESET_BACKGROUNDS.find((b) => b.id === value);
                  if (bg) setCurrentBackground(bg);
                }}
              >
                <SelectTrigger aria-label={t('backgroundImageTitle')} className='w-36 sm:w-44'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_BACKGROUNDS.map((bg) => (
                    <SelectItem key={bg.id} value={bg.id}>
                      {bg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
          <SettingRow
            title={t('aiThemeGeneration')}
            description={t('aiThemeGenerationHint')}
            layout='stacked'
          >
            <button
              type='button'
              onClick={() => {
                const prompt = translate('aiThemeGenerationExamplePrompt');
                void navigator.clipboard.writeText(prompt);
              }}
              className='flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground'
            >
              <Wand2 className='h-4 w-4' />
              {t('aiThemeCopyPrompt')}
            </button>
          </SettingRow>
        </SettingsGroup>
      </SettingsSection>
    </SettingsPage>
  );
}
