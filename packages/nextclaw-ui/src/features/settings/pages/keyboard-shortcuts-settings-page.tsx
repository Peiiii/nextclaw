import { useViewportLayout } from '@/app/hooks/use-viewport-layout';
import { ChatVoiceShortcutControl } from '@/features/chat';
import { SettingsPage } from '@/shared/components/settings/settings-page';
import { SettingRow, SettingsGroup, SettingsSection } from '@/shared/components/settings/setting-row';
import { t } from '@/shared/lib/i18n';

export function KeyboardShortcutsSettingsPage() {
  const { isMobile } = useViewportLayout();
  return <SettingsPage title={t('keyboardShortcuts')}>
    {isMobile ? <p className='text-sm text-muted-foreground'>{t('keyboardShortcutsDesktopOnly')}</p> :
      <SettingsSection><SettingsGroup>
        <SettingRow title={t('chatInputVoice')} layout='stacked'><ChatVoiceShortcutControl /></SettingRow>
      </SettingsGroup></SettingsSection>}
  </SettingsPage>;
}
