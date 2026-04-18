import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmRechargeIntent,
  fetchAdminRechargeIntents,
  rejectRechargeIntent
} from '@/api/client';
import type { RechargeIntentItem } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { TableWrap } from '@/components/ui/table';
import { formatUsd } from '@/lib/utils';

type Props = {
  token: string;
};

type IntentStatus = 'all' | 'pending' | 'confirmed' | 'rejected';

const PAGE_SIZE = 20;

export function AdminRechargeReviewPage({ token }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [intentStatus, setIntentStatus] = useState<IntentStatus>('pending');
  const [intentCursor, setIntentCursor] = useState<string | null>(null);
  const [intentCursorHistory, setIntentCursorHistory] = useState<Array<string | null>>([]);

  const intentsQuery = useQuery({
    queryKey: ['admin-intents', intentStatus, intentCursor],
    queryFn: async () => await fetchAdminRechargeIntents(token, {
      limit: PAGE_SIZE,
      status: intentStatus,
      cursor: intentCursor
    })
  });

  const confirmIntentMutation = useMutation({
    mutationFn: async (intentId: string) => {
      await confirmRechargeIntent(token, intentId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-intents'] });
    }
  });
  const rejectIntentMutation = useMutation({
    mutationFn: async (intentId: string) => {
      await rejectRechargeIntent(token, intentId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-intents'] });
    }
  });

  return (
    <div className="space-y-6">
      <Card className="space-y-4 rounded-[28px]">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">Recharge Review</p>
          <CardTitle>充值审核</CardTitle>
          <p className="text-sm text-slate-500">这里集中处理充值申请，避免与 Marketplace 审核、额度调整等治理动作混在同一页面。</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={intentStatus === 'pending' ? 'secondary' : 'ghost'}
            className="h-8 px-3"
            onClick={() => {
              setIntentStatus('pending');
              setIntentCursor(null);
              setIntentCursorHistory([]);
            }}
          >
            待处理
          </Button>
          <Button
            variant={intentStatus === 'all' ? 'secondary' : 'ghost'}
            className="h-8 px-3"
            onClick={() => {
              setIntentStatus('all');
              setIntentCursor(null);
              setIntentCursorHistory([]);
            }}
          >
            全部
          </Button>
        </div>

        {intentsQuery.isLoading ? <p className="text-sm text-slate-500">加载充值申请中...</p> : null}
        {intentsQuery.error instanceof Error ? <p className="text-sm text-rose-600">{intentsQuery.error.message}</p> : null}
        {confirmIntentMutation.error instanceof Error ? <p className="text-sm text-rose-600">{confirmIntentMutation.error.message}</p> : null}
        {rejectIntentMutation.error instanceof Error ? <p className="text-sm text-rose-600">{rejectIntentMutation.error.message}</p> : null}

        <RechargeTable
          intents={intentsQuery.data?.items ?? []}
          onConfirm={(intentId) => confirmIntentMutation.mutate(intentId)}
          onReject={(intentId) => rejectIntentMutation.mutate(intentId)}
        />

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            className="h-8 px-3"
            disabled={intentCursorHistory.length === 0}
            onClick={() => {
              const previous = intentCursorHistory[intentCursorHistory.length - 1] ?? null;
              setIntentCursor(previous);
              setIntentCursorHistory((prev) => prev.slice(0, -1));
            }}
          >
            上一页
          </Button>
          <Button
            variant="secondary"
            className="h-8 px-3"
            disabled={!intentsQuery.data?.hasMore || !intentsQuery.data?.nextCursor}
            onClick={() => {
              setIntentCursorHistory((prev) => [...prev, intentCursor]);
              setIntentCursor(intentsQuery.data?.nextCursor ?? null);
            }}
          >
            下一页
          </Button>
        </div>
      </Card>
    </div>
  );
}

function RechargeTable(props: {
  intents: RechargeIntentItem[];
  onConfirm: (intentId: string) => void;
  onReject: (intentId: string) => void;
}): JSX.Element {
  return (
    <TableWrap>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">申请时间</th>
            <th className="px-3 py-2">用户</th>
            <th className="px-3 py-2">金额</th>
            <th className="px-3 py-2">状态</th>
            <th className="px-3 py-2">操作</th>
          </tr>
        </thead>
        <tbody>
          {props.intents.map((intent) => (
            <tr key={intent.id} className="border-t border-slate-100">
              <td className="px-3 py-2">{new Date(intent.createdAt).toLocaleString()}</td>
              <td className="px-3 py-2">{intent.userId}</td>
              <td className="px-3 py-2">{formatUsd(intent.amountUsd)}</td>
              <td className="px-3 py-2">{intent.status}</td>
              <td className="px-3 py-2">
                {intent.status === 'pending' ? (
                  <div className="flex gap-2">
                    <Button className="h-8 px-2" onClick={() => props.onConfirm(intent.id)}>通过</Button>
                    <Button variant="danger" className="h-8 px-2" onClick={() => props.onReject(intent.id)}>拒绝</Button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">已处理</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}
