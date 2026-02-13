import { useState, useEffect } from 'react';
import { useConfig, useUpdateModel } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save, Sparkles, Sliders, Folder } from 'lucide-react';

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
        <Card className="rounded-2xl border-[hsl(40,20%,90%)] p-6">
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
        <Card className="rounded-2xl border-[hsl(40,20%,90%)] p-6">
          <Skeleton className="h-5 w-24 mb-2" />
          <Skeleton className="h-3 w-40 mb-6" />
          <div className="space-y-6">
            <div>
              <Skeleton className="h-4 w-28 mb-3" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <div>
              <Skeleton className="h-4 w-32 mb-3" />
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
        <h2 className="text-2xl font-bold text-[hsl(30,15%,10%)]">Model Configuration</h2>
        <p className="text-[14px] text-[hsl(30,8%,55%)] mt-1">Configure default AI model and behavior parameters</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Model Card */}
          <div className="p-8 rounded-[2rem] bg-[hsl(40,10%,98%)] border border-[hsl(40,10%,94%)]">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-10 w-10 rounded-xl bg-[hsl(30,15%,10%)] flex items-center justify-center text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-[hsl(30,15%,10%)]">Default Model</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model" className="text-[12px] font-bold text-[hsl(30,8%,45%)] uppercase tracking-wider">Model Name</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="minimax/MiniMax-M2.1"
                className="h-12 px-4 rounded-xl border-[hsl(40,10%,92%)] bg-white focus:ring-1 focus:ring-[hsl(30,15%,10%)] transition-all"
              />
              <p className="text-[12px] text-[hsl(30,8%,55%)]">Examples: minimax/MiniMax-M2.1 · anthropic/claude-opus-4-5</p>
            </div>
          </div>

          {/* Workspace Card */}
          <div className="p-8 rounded-[2rem] bg-[hsl(40,10%,98%)] border border-[hsl(40,10%,94%)]">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-10 w-10 rounded-xl bg-[hsl(30,15%,10%)] flex items-center justify-center text-white">
                <Folder className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-[hsl(30,15%,10%)]">Workspace</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspace" className="text-[12px] font-bold text-[hsl(30,8%,45%)] uppercase tracking-wider">Default Path</Label>
              <Input
                id="workspace"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder="/path/to/workspace"
                className="h-12 px-4 rounded-xl border-[hsl(40,10%,92%)] bg-white focus:ring-1 focus:ring-[hsl(30,15%,10%)] transition-all"
              />
            </div>
          </div>
        </div>

        {/* Parameters Section */}
        <div className="p-8 rounded-[2.5rem] bg-white border border-[hsl(40,10%,94%)] shadow-sm">
          <div className="flex items-center gap-4 mb-10">
            <div className="h-10 w-10 rounded-xl bg-[hsl(30,15%,10%)] flex items-center justify-center text-white">
              <Sliders className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-[hsl(30,15%,10%)]">Generation Parameters</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <Label className="text-[12px] font-bold text-[hsl(30,8%,45%)] uppercase tracking-wider">Max Tokens</Label>
                <span className="text-[13px] font-bold text-[hsl(30,15%,10%)]">{maxTokens.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="1000"
                max="32000"
                step="1000"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full h-1 bg-[hsl(40,10%,92%)] rounded-full appearance-none cursor-pointer accent-[hsl(30,15%,10%)]"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <Label className="text-[12px] font-bold text-[hsl(30,8%,45%)] uppercase tracking-wider">Temperature</Label>
                <span className="text-[13px] font-bold text-[hsl(30,15%,10%)]">{temperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-1 bg-[hsl(40,10%,92%)] rounded-full appearance-none cursor-pointer accent-[hsl(30,15%,10%)]"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            disabled={updateModel.isPending}
            className="h-12 px-8 rounded-2xl bg-[hsl(30,15%,10%)] text-white hover:bg-[hsl(30,15%,20%)] transition-all font-bold shadow-md active:scale-95"
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
