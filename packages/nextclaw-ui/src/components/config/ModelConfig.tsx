import { useState, useEffect } from 'react';
import { useConfig, useUpdateModel } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Cpu, Save } from 'lucide-react';

export function ModelConfig() {
  const { data: config, isLoading } = useConfig();
  const updateModel = useUpdateModel();

  const [model, setModel] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [maxTokens, setMaxTokens] = useState(8192);
  const [temperature, setTemperature] = useState(0.7);

  useEffect(() => {
    if (config?.agents?.defaults) {
      setModel(config.agents.defaults.model || '');
      setWorkspace(config.agents.defaults.workspace || '');
      setMaxTokens(config.agents.defaults.maxTokens || 8192);
      setTemperature(config.agents.defaults.temperature || 0.7);
    }
  }, [config]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateModel.mutate({ model });
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
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-10 w-full" />
        </Card>
        <Card className="p-6">
          <Skeleton className="h-5 w-24 mb-2" />
          <Skeleton className="h-3 w-40 mb-6" />
          <div className="space-y-4">
            <div>
              <Skeleton className="h-4 w-28 mb-2" />
              <Skeleton className="h-2 w-full" />
            </div>
            <div>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-2 w-full" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-slate-900">模型配置</h2>
        <p className="text-sm text-slate-500 mt-1">配置默认 AI 模型和行为参数</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-slate-900 flex items-center justify-center">
                <Cpu className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">默认模型</CardTitle>
                <CardDescription>选择要使用的 AI 模型</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model">模型名称</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="例如: gpt-4, claude-3-opus"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">生成参数</CardTitle>
            <CardDescription>调整模型生成文本的行为</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="maxTokens">最大 Token 数</Label>
                <span className="text-sm text-slate-500">{maxTokens}</span>
              </div>
              <Input
                id="maxTokens"
                type="range"
                min="1000"
                max="32000"
                step="1000"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="temperature">温度 (Temperature)</Label>
                <span className="text-sm text-slate-500">{temperature}</span>
              </div>
              <Input
                id="temperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-slate-400">
                较低的值使输出更确定，较高的值使输出更随机
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">工作区</CardTitle>
            <CardDescription>设置默认工作目录</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="workspace">工作区路径</Label>
              <Input
                id="workspace"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder="/path/to/workspace"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={updateModel.isPending}
            className="gap-2"
          >
            {updateModel.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                保存配置
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
