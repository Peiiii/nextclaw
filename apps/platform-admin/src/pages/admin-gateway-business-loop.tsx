import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAdminProvider,
  fetchAdminModels,
  fetchAdminProfitOverview,
  fetchAdminProviders,
  updateAdminProvider,
  upsertAdminModel
} from '@/api/client';
import type { AdminProfitOverview, ModelCatalogView, ProviderAccountView } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TableWrap } from '@/components/ui/table';
import { formatUsd } from '@/lib/utils';

type Props = {
  token: string;
};

type ProviderFormState = {
  provider: string;
  displayName: string;
  authType: 'oauth' | 'api_key';
  apiBase: string;
  accessToken: string;
  priority: string;
  enabled: boolean;
};

type ModelFormState = {
  publicModelId: string;
  providerAccountId: string;
  upstreamModel: string;
  displayName: string;
  enabled: boolean;
  sellInputUsdPer1M: string;
  sellOutputUsdPer1M: string;
  upstreamInputUsdPer1M: string;
  upstreamOutputUsdPer1M: string;
};

export function GatewayBusinessLoopSection({ token }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [profitDays, setProfitDays] = useState(7);
  const [providerForm, setProviderForm] = useState<ProviderFormState>({
    provider: 'dashscope',
    displayName: '',
    authType: 'oauth',
    apiBase: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    accessToken: '',
    priority: '100',
    enabled: true
  });
  const [modelForm, setModelForm] = useState<ModelFormState>({
    publicModelId: 'openai/gpt-4o',
    providerAccountId: '',
    upstreamModel: 'qwen-plus',
    displayName: '',
    enabled: true,
    sellInputUsdPer1M: '6',
    sellOutputUsdPer1M: '18',
    upstreamInputUsdPer1M: '2.4',
    upstreamOutputUsdPer1M: '7.2'
  });

  const providersQuery = useQuery({
    queryKey: ['admin-providers'],
    queryFn: async () => await fetchAdminProviders(token)
  });

  const modelsQuery = useQuery({
    queryKey: ['admin-models'],
    queryFn: async () => await fetchAdminModels(token)
  });

  const profitQuery = useQuery({
    queryKey: ['admin-profit', profitDays],
    queryFn: async () => await fetchAdminProfitOverview(token, profitDays)
  });

  const createProviderMutation = useMutation({
    mutationFn: async () => {
      await createAdminProvider(token, {
        provider: providerForm.provider.trim(),
        displayName: providerForm.displayName.trim(),
        authType: providerForm.authType,
        apiBase: providerForm.apiBase.trim(),
        accessToken: providerForm.accessToken.trim(),
        enabled: providerForm.enabled,
        priority: Number(providerForm.priority)
      });
    },
    onSuccess: async () => {
      setProviderForm((prev) => ({ ...prev, accessToken: '' }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-providers'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-models'] })
      ]);
    }
  });

  const patchProviderMutation = useMutation({
    mutationFn: async (payload: { providerId: string; enabled: boolean }) => {
      await updateAdminProvider(token, payload.providerId, { enabled: payload.enabled });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-providers'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-models'] })
      ]);
    }
  });

  const upsertModelMutation = useMutation({
    mutationFn: async () => {
      await upsertAdminModel(token, modelForm.publicModelId.trim(), {
        providerAccountId: modelForm.providerAccountId.trim(),
        upstreamModel: modelForm.upstreamModel.trim(),
        displayName: modelForm.displayName.trim(),
        enabled: modelForm.enabled,
        sellInputUsdPer1M: Number(modelForm.sellInputUsdPer1M),
        sellOutputUsdPer1M: Number(modelForm.sellOutputUsdPer1M),
        upstreamInputUsdPer1M: Number(modelForm.upstreamInputUsdPer1M),
        upstreamOutputUsdPer1M: Number(modelForm.upstreamOutputUsdPer1M)
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-models'] });
    }
  });

  const providers = providersQuery.data?.items ?? [];
  const models = modelsQuery.data?.items ?? [];

  useEffect(() => {
    if (providers.length === 0) {
      return;
    }
    setModelForm((prev) => {
      if (prev.providerAccountId.trim().length > 0) {
        return prev;
      }
      return { ...prev, providerAccountId: providers[0].id };
    });
  }, [providers]);

  return (
    <>
      <ProfitOverviewCard
        profit={profitQuery.data}
        days={profitDays}
        onDaysChange={setProfitDays}
      />

      <ProviderManagementCard
        providers={providers}
        providerForm={providerForm}
        submitting={createProviderMutation.isPending}
        patching={patchProviderMutation.isPending}
        onFormChange={(patch) => {
          setProviderForm((prev) => ({ ...prev, ...patch }));
        }}
        onSubmit={() => createProviderMutation.mutate()}
        onToggleEnabled={(provider) => {
          patchProviderMutation.mutate({
            providerId: provider.id,
            enabled: !provider.enabled
          });
        }}
      />

      <ModelCatalogCard
        models={models}
        providers={providers}
        modelForm={modelForm}
        submitting={upsertModelMutation.isPending}
        onFormChange={(patch) => {
          setModelForm((prev) => ({ ...prev, ...patch }));
        }}
        onSubmit={() => upsertModelMutation.mutate()}
      />
    </>
  );
}

type ProfitOverviewCardProps = {
  profit: AdminProfitOverview | undefined;
  days: number;
  onDaysChange: (days: number) => void;
};

function ProfitOverviewCard({ profit, days, onDaysChange }: ProfitOverviewCardProps): JSX.Element {
  return (
    <Card className="space-y-3">
      <CardTitle>利润总览</CardTitle>
      <div className="grid gap-3 md:grid-cols-5">
        <div>
          <p className="text-xs text-slate-500">统计窗口</p>
          <p className="mt-1 text-lg font-semibold">{days} 天</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">请求数</p>
          <p className="mt-1 text-lg font-semibold">{profit?.requests ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">营收</p>
          <p className="mt-1 text-lg font-semibold">{formatUsd(profit?.totalChargeUsd ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">上游成本</p>
          <p className="mt-1 text-lg font-semibold">{formatUsd(profit?.totalUpstreamCostUsd ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">毛利率</p>
          <p className="mt-1 text-lg font-semibold">{((profit?.grossMarginRate ?? 0) * 100).toFixed(2)}%</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {[1, 7, 30].map((windowDays) => (
          <Button
            key={windowDays}
            variant={days === windowDays ? 'secondary' : 'ghost'}
            className="h-8 px-3"
            onClick={() => onDaysChange(windowDays)}
          >
            {windowDays} 天
          </Button>
        ))}
      </div>
    </Card>
  );
}

type ProviderManagementCardProps = {
  providers: ProviderAccountView[];
  providerForm: ProviderFormState;
  submitting: boolean;
  patching: boolean;
  onFormChange: (patch: Partial<ProviderFormState>) => void;
  onSubmit: () => void;
  onToggleEnabled: (provider: ProviderAccountView) => void;
};

function ProviderManagementCard({
  providers,
  providerForm,
  submitting,
  patching,
  onFormChange,
  onSubmit,
  onToggleEnabled
}: ProviderManagementCardProps): JSX.Element {
  return (
    <Card className="space-y-3">
      <CardTitle>上游供应商账号</CardTitle>
      <p className="text-sm text-slate-500">创建平台托管上游账号（优先 OAuth token），由平台统一代理调用。</p>
      <form
        className="grid gap-2 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Input
          value={providerForm.provider}
          onChange={(event) => onFormChange({ provider: event.target.value })}
          placeholder="provider，如 dashscope"
        />
        <Input
          value={providerForm.displayName}
          onChange={(event) => onFormChange({ displayName: event.target.value })}
          placeholder="展示名（可选）"
        />
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={providerForm.authType}
          onChange={(event) => onFormChange({ authType: event.target.value as 'oauth' | 'api_key' })}
        >
          <option value="oauth">oauth</option>
          <option value="api_key">api_key</option>
        </select>
        <Input
          value={providerForm.apiBase}
          onChange={(event) => onFormChange({ apiBase: event.target.value })}
          placeholder="API Base"
        />
        <Input
          type="password"
          value={providerForm.accessToken}
          onChange={(event) => onFormChange({ accessToken: event.target.value })}
          placeholder="Access Token"
        />
        <Input
          value={providerForm.priority}
          onChange={(event) => onFormChange({ priority: event.target.value })}
          placeholder="优先级（越小越优先）"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={providerForm.enabled}
            onChange={(event) => onFormChange({ enabled: event.target.checked })}
          />
          启用
        </label>
        <div className="md:col-span-2">
          <Button type="submit" disabled={submitting} className="h-10 px-4">新增上游账号</Button>
        </div>
      </form>

      <TableWrap>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">认证</th>
              <th className="px-3 py-2">API Base</th>
              <th className="px-3 py-2">Token</th>
              <th className="px-3 py-2">优先级</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((provider) => (
              <tr key={provider.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{provider.provider}</td>
                <td className="px-3 py-2">{provider.authType}</td>
                <td className="px-3 py-2">{provider.apiBase}</td>
                <td className="px-3 py-2">{provider.tokenSet ? '已设置' : '未设置'}</td>
                <td className="px-3 py-2">{provider.priority}</td>
                <td className="px-3 py-2">{provider.enabled ? '启用' : '停用'}</td>
                <td className="px-3 py-2">
                  <Button
                    variant="secondary"
                    className="h-8 px-2"
                    disabled={patching}
                    onClick={() => onToggleEnabled(provider)}
                  >
                    {provider.enabled ? '停用' : '启用'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Card>
  );
}

type ModelCatalogCardProps = {
  models: ModelCatalogView[];
  providers: ProviderAccountView[];
  modelForm: ModelFormState;
  submitting: boolean;
  onFormChange: (patch: Partial<ModelFormState>) => void;
  onSubmit: () => void;
};

function ModelCatalogCard({
  models,
  providers,
  modelForm,
  submitting,
  onFormChange,
  onSubmit
}: ModelCatalogCardProps): JSX.Element {
  return (
    <Card className="space-y-3">
      <CardTitle>模型目录与定价</CardTitle>
      <p className="text-sm text-slate-500">维护对外模型名与上游模型映射，并设置销售价与上游成本，用于毛利核算。</p>
      <form
        className="grid gap-2 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Input
          value={modelForm.publicModelId}
          onChange={(event) => onFormChange({ publicModelId: event.target.value })}
          placeholder="对外模型名，如 openai/gpt-4o"
        />
        <select
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
          value={modelForm.providerAccountId}
          onChange={(event) => onFormChange({ providerAccountId: event.target.value })}
        >
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.provider} / {provider.id.slice(0, 8)}
            </option>
          ))}
        </select>
        <Input
          value={modelForm.upstreamModel}
          onChange={(event) => onFormChange({ upstreamModel: event.target.value })}
          placeholder="上游模型名"
        />
        <Input
          value={modelForm.displayName}
          onChange={(event) => onFormChange({ displayName: event.target.value })}
          placeholder="展示名（可选）"
        />
        <Input
          value={modelForm.sellInputUsdPer1M}
          onChange={(event) => onFormChange({ sellInputUsdPer1M: event.target.value })}
          placeholder="销售输入价 USD/1M"
        />
        <Input
          value={modelForm.sellOutputUsdPer1M}
          onChange={(event) => onFormChange({ sellOutputUsdPer1M: event.target.value })}
          placeholder="销售输出价 USD/1M"
        />
        <Input
          value={modelForm.upstreamInputUsdPer1M}
          onChange={(event) => onFormChange({ upstreamInputUsdPer1M: event.target.value })}
          placeholder="上游输入成本 USD/1M"
        />
        <Input
          value={modelForm.upstreamOutputUsdPer1M}
          onChange={(event) => onFormChange({ upstreamOutputUsdPer1M: event.target.value })}
          placeholder="上游输出成本 USD/1M"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={modelForm.enabled}
            onChange={(event) => onFormChange({ enabled: event.target.checked })}
          />
          启用
        </label>
        <div className="md:col-span-3">
          <Button type="submit" disabled={submitting} className="h-10 px-4">保存模型映射</Button>
        </div>
      </form>

      <TableWrap>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">对外模型</th>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">上游模型</th>
              <th className="px-3 py-2">销售价(输入/输出)</th>
              <th className="px-3 py-2">成本(输入/输出)</th>
              <th className="px-3 py-2">状态</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.publicModelId} className="border-t border-slate-100">
                <td className="px-3 py-2">{model.publicModelId}</td>
                <td className="px-3 py-2">{model.providerAccountId.slice(0, 8)}</td>
                <td className="px-3 py-2">{model.upstreamModel}</td>
                <td className="px-3 py-2">
                  {model.sellInputUsdPer1M}/{model.sellOutputUsdPer1M}
                </td>
                <td className="px-3 py-2">
                  {model.upstreamInputUsdPer1M}/{model.upstreamOutputUsdPer1M}
                </td>
                <td className="px-3 py-2">{model.enabled ? '启用' : '停用'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Card>
  );
}
