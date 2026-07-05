import { Palette } from 'lucide-react';
import { PageHeader, PageLayout } from '@/app/components/layout/page-layout';
import { SettingRow } from '@/shared/components/settings/setting-row';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Switch } from '@/shared/components/ui/switch';
import { useSideDockStore } from '@/features/side-dock';
import { t } from '@/shared/lib/i18n';

export function AppearanceSettingsPage() {
  const isSideDockVisible = useSideDockStore((state) => state.isVisible);
  const setSideDockVisible = useSideDockStore((state) => state.setVisible);

  return (
    <PageLayout>
      <PageHeader title={t('appearance')} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            {t('appearance')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SettingRow
            title={t('sideDockVisibilityTitle')}
            description={t('sideDockVisibilityDescription')}
            control={
              <Switch
                id="appearance-side-dock-visible"
                aria-label={t('sideDockVisibilityTitle')}
                checked={isSideDockVisible}
                onCheckedChange={setSideDockVisible}
              />
            }
          />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
