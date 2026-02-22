import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfig, useConfigSchema, useUpdateModel } from '@/hooks/useConfig';
import { hintForPath } from '@/lib/config-hints';
import { Folder, Loader2, Sliders, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ModelConfig() {
  const { data: config, isLoading } = useConfig();
  const { data: schema } = useConfigSchema();
  const updateModel = useUpdateModel();

  const [model, setModel] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [maxTokens, setMaxTokens] = useState(8192);
  const uiHints = schema?.uiHints;
  const modelHint = hintForPath('agents.defaults.model', uiHints);
  const workspaceHint = hintForPath('agents.defaults.workspace', uiHints);
  const maxTokensHint = hintForPath('agents.defaults.maxTokens', uiHints);

  useEffect(() => {
    if (config?.agents?.defaults) {
      setModel(config.agents.defaults.model || '');
      setWorkspace(config.agents.defaults.workspace || '');
      setMaxTokens(config.agents.defaults.maxTokens || 8192);
    }
  }, [config]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateModel.mutate({ model, maxTokens });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Card className="rounded-2xl border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-6">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </Card>
        <Card className="rounded-2xl border-gray-200 p-6">
          <Skeleton className="h-5 w-24 mb-2" />
          <Skeleton className="h-3 w-40 mb-6" />
          <div className="space-y-6">
            <div>
              <Skeleton className="h-4 w-28 mb-3" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl animate-fade-in pb-20">
      <div className="mb-10">
        <h2 className="text-2xl font-bold text-gray-900">Model Configuration</h2>
        <p className="text-sm text-gray-500 mt-1">Configure default AI model and runtime limits</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Model Card */}
          <div className="p-8 rounded-2xl bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Default Model</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {modelHint?.label ?? 'Model Name'}
              </Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={modelHint?.placeholder ?? 'minimax/MiniMax-M2.1'}
                className="h-12 px-4 rounded-xl"
              />
              <p className="text-xs text-gray-400">
                {modelHint?.help ??
                  'Examples: minimax/MiniMax-M2.5 · minimax/MiniMax-M2.1 · openrouter/anthropic/claude-3.5-sonnet · openrouter/openai/gpt-4o-mini'}
              </p>
            </div>
          </div>

          {/* Workspace Card */}
          <div className="p-8 rounded-2xl bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white">
                <Folder className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Workspace</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspace" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {workspaceHint?.label ?? 'Default Path'}
              </Label>
              <Input
                id="workspace"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder={workspaceHint?.placeholder ?? '/path/to/workspace'}
                className="h-12 px-4 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Parameters Section */}
        <div className="p-8 rounded-2xl bg-white border border-gray-200 shadow-card">
          <div className="flex items-center gap-4 mb-10">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white">
              <Sliders className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Generation Parameters</h3>
          </div>

          <div className="grid grid-cols-1 gap-12">
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {maxTokensHint?.label ?? 'Max Tokens'}
                </Label>
                <span className="text-sm font-semibold text-gray-900">{maxTokens.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="1000"
                max="32000"
                step="1000"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            disabled={updateModel.isPending}
            size="lg"
          >
            {updateModel.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
