import { useState } from 'react';
import { useConfig, useUpdateUiConfig, useReloadConfig } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { t } from '@/lib/i18n';
import { Loader2, RefreshCw } from 'lucide-react';

export function UiConfig() {
  const { data: config, isLoading } = useConfig();
  const updateUiConfig = useUpdateUiConfig();
  const reloadConfig = useReloadConfig();

  const [enabled, setEnabled] = useState(false);
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(18791);
  const [open, setOpen] = useState(false);

  useState(() => {
    if (config?.ui) {
      setEnabled(config.ui.enabled);
      setHost(config.ui.host);
      setPort(config.ui.port);
      setOpen(config.ui.open);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUiConfig.mutate({ enabled, host, port, open });
  };

  const handleReload = () => {
    reloadConfig.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('uiConfig')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div className="flex items-center justify-between">
              <Label htmlFor="enabled">{t('enabled')}</Label>
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="host">{t('host')}</Label>
              <Input
                id="host"
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="port">{t('port')}</Label>
              <Input
                id="port"
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value) || 18791)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="open">{t('open')}</Label>
              <Switch
                id="open"
                checked={open}
                onCheckedChange={setOpen}
              />
            </div>

            <Button type="submit" disabled={updateUiConfig.isPending}>
              {updateUiConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('reloadConfig')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            重载配置以应用所有更改
          </p>
          <Button
            variant="outline"
            onClick={handleReload}
            disabled={reloadConfig.isPending}
          >
            {reloadConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('reloadConfig')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
