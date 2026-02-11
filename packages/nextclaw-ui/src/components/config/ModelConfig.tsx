import { useState, useEffect } from 'react';
import { useConfig, useUpdateModel } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { t } from '@/lib/i18n';
import { Loader2 } from 'lucide-react';

export function ModelConfig() {
  const { data: config, isLoading } = useConfig();
  const updateModel = useUpdateModel();
  const [model, setModel] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [maxTokens, setMaxTokens] = useState(8192);
  const [temperature, setTemperature] = useState(0.7);
  const [maxToolIterations, setMaxToolIterations] = useState(20);

  // Initialize form data when config loads
  useEffect(() => {
    if (config?.agents?.defaults) {
      setModel(config.agents.defaults.model || '');
      setWorkspace(config.agents.defaults.workspace || '');
      setMaxTokens(config.agents.defaults.maxTokens || 8192);
      setTemperature(config.agents.defaults.temperature || 0.7);
      setMaxToolIterations(config.agents.defaults.maxToolIterations || 20);
    }
  }, [config]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateModel.mutate({ model });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('modelName')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="model">{t('modelName')}</Label>
            <Input
              id="model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="anthropic/claude-opus-4-5"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="workspace">{t('workspace')}</Label>
            <Input
              id="workspace"
              type="text"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxTokens">{t('maxTokens')}</Label>
            <Input
              id="maxTokens"
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value) || 8192)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="temperature">{t('temperature')}</Label>
            <Input
              id="temperature"
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value) || 0.7)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxToolIterations">{t('maxToolIterations')}</Label>
            <Input
              id="maxToolIterations"
              type="number"
              value={maxToolIterations}
              onChange={(e) => setMaxToolIterations(parseInt(e.target.value) || 20)}
            />
          </div>

          <Button type="submit" disabled={updateModel.isPending}>
            {updateModel.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
