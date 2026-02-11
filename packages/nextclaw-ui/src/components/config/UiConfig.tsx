import { useState, useEffect } from 'react';
import { useConfig, useUpdateUiConfig, useReloadConfig } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Globe, Save } from 'lucide-react';

export function UiConfig() {
  const { data: config, isLoading } = useConfig();
  const updateUiConfig = useUpdateUiConfig();
  const reloadConfig = useReloadConfig();

  const [enabled, setEnabled] = useState(false);
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(18791);

  useEffect(() => {
    if (config?.ui) {
      setEnabled(config.ui.enabled);
      setHost(config.ui.host);
      setPort(config.ui.port);
    }
  }, [config]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUiConfig.mutate({ enabled, host, port, open: true });
  };

  const handleReload = () => {
    reloadConfig.mutate();
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
          <Skeleton className="h-16 w-full rounded-lg mb-4" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div>
              <Skeleton className="h-4 w-12 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">界面设置</h2>
        <p className="text-sm text-slate-500 mt-1">配置 Web UI 服务器和访问选项</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-900 flex items-center justify-center">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Web UI 服务器</CardTitle>
              <CardDescription>配置界面服务的运行参数</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <h3 className="font-medium text-slate-900">启用 Web UI</h3>
                <p className="text-xs text-slate-500">
                  {enabled ? '服务正在运行' : '服务已停止'}
                </p>
              </div>
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="host">监听地址</Label>
                <Input
                  id="host"
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="127.0.0.1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="port">端口</Label>
                <Input
                  id="port"
                  type="number"
                  value={port}
                  onChange={(e) => setPort(parseInt(e.target.value) || 18791)}
                  placeholder="18791"
                  min="1"
                  max="65535"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateUiConfig.isPending}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                保存配置
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <CardTitle className="text-base">重载配置</CardTitle>
              <CardDescription>应用配置更改并重启服务</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 mb-4">
            点击下方按钮将重载配置文件，使所有更改生效。
          </p>
          <Button
            variant="outline"
            onClick={handleReload}
            disabled={reloadConfig.isPending}
            className="w-full gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            重载配置
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
