import { useConfig, useConfigMeta } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { t } from '@/lib/i18n';
import { MessageCircle } from 'lucide-react';
import { useUiStore } from '@/stores/ui.store';
import { ChannelForm } from './ChannelForm';
import { cn } from '@/lib/utils';

export function ChannelsList() {
  const { data: config } = useConfig();
  const { data: meta } = useConfigMeta();
  const { openChannelModal } = useUiStore();

  if (!config || !meta) {
    return <div className="text-muted-foreground">{t('loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {meta.channels.map((channel) => {
          const channelConfig = config.channels[channel.name];
          const enabled = channelConfig?.enabled || false;

          return (
            <Card key={channel.name} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{channel.displayName || channel.name}</span>
                  <MessageCircle className={cn('h-4 w-4', enabled ? 'text-green-500' : 'text-muted-foreground')} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('enabled')}</span>
                    <span className={enabled ? 'text-green-500' : 'text-muted-foreground'}>
                      {enabled ? '是' : '否'}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => openChannelModal(channel.name)}
                  >
                    {t('edit')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <ChannelForm />
    </div>
  );
}
