import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRechargeIntent,
  fetchBillingLedger,
  fetchBillingOverview,
  fetchRechargeIntents,
  fetchRemoteDevices,
  openRemoteDevice
} from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TableWrap } from '@/components/ui/table';
import { formatUsd, toFixedUsd } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';

type Props = {
  token: string;
};

type RemoteDevicesCardProps = {
  token: string;
};

function RemoteDevicesCard({ token }: RemoteDevicesCardProps): JSX.Element {
  const remoteDevicesQuery = useQuery({
    queryKey: ['remote-devices'],
    queryFn: async () => await fetchRemoteDevices(token)
  });

  const openRemoteMutation = useMutation({
    mutationFn: async (deviceId: string) => await openRemoteDevice(token, deviceId),
    onSuccess: (session) => {
      window.open(session.openUrl, '_blank', 'noopener,noreferrer');
    }
  });

  return (
    <Card className="space-y-3">
      <CardTitle>NextClaw Web 设备</CardTitle>
      <p className="text-sm text-slate-500">
        在桌面端开启远程访问后，这台设备会自动出现在这里。你可以直接在网页中打开它，继续使用同一条 Agent 链路。
      </p>
      <TableWrap>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">设备</th>
              <th className="px-3 py-2">平台</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">最近在线</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {(remoteDevicesQuery.data?.items ?? []).map((device) => (
              <tr key={device.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900">{device.displayName}</div>
                  <div className="text-xs text-slate-500">{device.appVersion}</div>
                </td>
                <td className="px-3 py-2">{device.platform}</td>
                <td className="px-3 py-2">
                  <span className={device.status === 'online' ? 'text-emerald-600' : 'text-slate-500'}>
                    {device.status}
                  </span>
                </td>
                <td className="px-3 py-2">{new Date(device.lastSeenAt).toLocaleString()}</td>
                <td className="px-3 py-2 text-right">
                  <Button
                    onClick={() => openRemoteMutation.mutate(device.id)}
                    disabled={device.status !== 'online' || openRemoteMutation.isPending}
                  >
                    在网页中打开
                  </Button>
                </td>
              </tr>
            ))}
            {!remoteDevicesQuery.isLoading && (remoteDevicesQuery.data?.items?.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-sm text-slate-500">
                  还没有可用设备。先回到桌面端登录 NextClaw 并开启远程访问。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableWrap>
      {remoteDevicesQuery.error ? (
        <p className="text-sm text-rose-600">
          {remoteDevicesQuery.error instanceof Error ? remoteDevicesQuery.error.message : '设备加载失败'}
        </p>
      ) : null}
      {openRemoteMutation.error ? (
        <p className="text-sm text-rose-600">
          {openRemoteMutation.error instanceof Error ? openRemoteMutation.error.message : '打开设备失败'}
        </p>
      ) : null}
    </Card>
  );
}

export function UserDashboardPage({ token }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [rechargeAmount, setRechargeAmount] = useState('20');
  const [rechargeNote, setRechargeNote] = useState('');
  const setUser = useAuthStore((state) => state.setUser);

  const overviewQuery = useQuery({
    queryKey: ['billing-overview'],
    queryFn: async () => await fetchBillingOverview(token)
  });

  const ledgerQuery = useQuery({
    queryKey: ['billing-ledger'],
    queryFn: async () => await fetchBillingLedger(token)
  });

  const intentsQuery = useQuery({
    queryKey: ['billing-recharge-intents'],
    queryFn: async () => await fetchRechargeIntents(token)
  });

  const rechargeMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(rechargeAmount);
      await createRechargeIntent(token, amount, rechargeNote.trim());
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['billing-recharge-intents'] }),
        queryClient.invalidateQueries({ queryKey: ['billing-overview'] })
      ]);
      setRechargeNote('');
    }
  });

  const overview = overviewQuery.data;

  const summaryCards = useMemo(() => {
    if (!overview) {
      return [];
    }
    return [
      { label: '个人免费额度剩余', value: formatUsd(overview.user.freeRemainingUsd) },
      { label: '个人付费余额', value: formatUsd(overview.user.paidBalanceUsd) },
      { label: '全局免费池剩余', value: formatUsd(overview.globalFreeRemainingUsd) }
    ];
  }, [overview]);

  if (overviewQuery.isLoading) {
    return <p className="text-sm text-slate-500">加载用户账单中...</p>;
  }

  if (overviewQuery.error) {
    return <p className="text-sm text-rose-600">{overviewQuery.error instanceof Error ? overviewQuery.error.message : '加载失败'}</p>;
  }

  if (!overview) {
    return <p className="text-sm text-slate-500">无数据。</p>;
  }

  setUser(overview.user);

  return (
    <div className="space-y-6">
      <RemoteDevicesCard token={token} />

      <div className="grid gap-3 md:grid-cols-3">
        {summaryCards.map((item) => (
          <Card key={item.label}>
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{item.value}</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-3">
        <CardTitle>提交充值申请</CardTitle>
        <p className="text-sm text-slate-500">当前为“人工审核确认充值”的闭环，不做 credits 换算，直接 USD 入账。</p>
        <div className="grid gap-3 md:grid-cols-[160px_1fr_180px]">
          <Input value={rechargeAmount} onChange={(event) => setRechargeAmount(event.target.value)} placeholder="金额 (USD)" />
          <Input value={rechargeNote} onChange={(event) => setRechargeNote(event.target.value)} placeholder="备注（可选）" />
          <Button onClick={() => rechargeMutation.mutate()} disabled={rechargeMutation.isPending}>提交申请</Button>
        </div>
        {rechargeMutation.error ? (
          <p className="text-sm text-rose-600">{rechargeMutation.error instanceof Error ? rechargeMutation.error.message : '提交失败'}</p>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <CardTitle>充值申请记录</CardTitle>
          <TableWrap>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">时间</th>
                  <th className="px-3 py-2">金额</th>
                  <th className="px-3 py-2">状态</th>
                </tr>
              </thead>
              <tbody>
                {(intentsQuery.data?.items ?? []).map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{formatUsd(item.amountUsd)}</td>
                    <td className="px-3 py-2">{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>

        <Card className="space-y-3">
          <CardTitle>消费流水</CardTitle>
          <TableWrap>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">时间</th>
                  <th className="px-3 py-2">类型</th>
                  <th className="px-3 py-2">金额</th>
                </tr>
              </thead>
              <tbody>
                {(ledgerQuery.data?.items ?? []).map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{item.kind}</td>
                    <td className="px-3 py-2">
                      {item.amountUsd < 0 ? '-' : '+'}{toFixedUsd(Math.abs(item.amountUsd))} USD
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      </div>
    </div>
  );
}
