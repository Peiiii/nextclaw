import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DiscussionThreadCreateInput, DiscussionThreadPage, DiscussionThreadView, SupportWorkflowOperation, SupportReviewPage, SupportReport } from '@nextclaw/shared';
import { request } from '@/api/platform-client.utils';
import { reviewBuckets, reviewLabels } from '@/features/support-review/configs/support-review.config';

function initialFilters() {
  const params = new URLSearchParams(location.search);
  const bucket = params.get('feedback') ?? 'review';
  return { bucket: reviewBuckets.some(([key]) => key === bucket) ? bucket : 'review',
    q: params.get('q') ?? '', page: Math.max(1, Number(params.get('page')) || 1),
    pageSize: params.get('pageSize') === '20' ? 20 : 10 };
}
export function useSupportReview(token: string) {
  const client = useQueryClient();
  const [filters, setFilters] = useState(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const queue = useQuery({
    queryKey: ['support-review', token, filters],
    queryFn: async () => (await request<{ data: SupportReviewPage }>('/platform/admin/support?' + new URLSearchParams({
      bucket: filters.bucket, q: filters.q, page: String(filters.page), pageSize: String(filters.pageSize)
    }), {}, token)).data
  });
  const selected = queue.data?.items.find(item => item.id === selectedId) ?? queue.data?.items[0] ?? null;
  useEffect(() => {
    const url = new URL(location.href);
    for (const [key, value] of Object.entries({ feedback: filters.bucket, q: filters.q, page: filters.page, pageSize: filters.pageSize })) url.searchParams.set(key, String(value));
    history.replaceState(null, '', url);
  }, [filters]);
  const review = useMutation({
    mutationFn: async ({ report, decision, body }: { report: SupportReport; decision: NonNullable<SupportWorkflowOperation['decision']>; body: string }) =>
      request('/platform/admin/support/' + encodeURIComponent(report.id), { method: 'POST',
        body: JSON.stringify({ action: 'review', decision, body, operationId: crypto.randomUUID(), revision: report.revision, runId: report.runId }) }, token),
    onSuccess: async (_data, { report, decision }) => {
      const items = queue.data?.items ?? [];
      const index = items.findIndex(item => item.id === report.id);
      setSelectedId(items[index + 1]?.id ?? items[index - 1]?.id ?? null);
      setNotice(reviewLabels[decision] + '：' + report.title);
      setNotes(current => { const next = { ...current }; delete next[report.id]; return next; });
      await client.invalidateQueries({ queryKey: ['support-review'] });
    },
    onError: async () => { await client.invalidateQueries({ queryKey: ['support-review'] }); }
  });
  const update = (patch: Partial<typeof filters>) => {
    setFilters(current => ({ ...current, page: 1, ...patch })); setSelectedId(null); setNotice(''); review.reset();
  };
  const setNote = (id: string, body: string) => setNotes(current => ({ ...current, [id]: body }));
  return { queue, review, filters, update, selected, select: setSelectedId, notice, notes, setNote };
}

export function useDirectDiscussions(token: string) {
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['direct-discussions', token],
    queryFn: async () => (await request<{ data: DiscussionThreadPage }>('/platform/admin/discussions?space=direct', {}, token)).data,
  });
  const selected = selectedId ?? list.data?.items[0]?.id ?? null;
  const detail = useQuery({
    queryKey: ['direct-discussion', token, selected],
    enabled: Boolean(selected),
    queryFn: async () => (await request<{ data: DiscussionThreadView }>('/platform/admin/discussions/' + encodeURIComponent(selected!), {}, token)).data,
  });
  const create = useMutation({
    mutationFn: async (input: DiscussionThreadCreateInput) =>
      (await request<{ data: DiscussionThreadView }>('/platform/admin/discussions', { method: 'POST', body: JSON.stringify(input) }, token)).data,
    onSuccess: async value => {
      setSelectedId(value.thread.id);
      await client.invalidateQueries({ queryKey: ['direct-discussions'] });
      client.setQueryData(['direct-discussion', token, value.thread.id], value);
    },
  });
  const post = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) =>
      (await request<{ data: DiscussionThreadView }>('/platform/admin/discussions/' + encodeURIComponent(id) + '/posts', {
        method: 'POST', body: JSON.stringify({ operationId: crypto.randomUUID(), body }),
      }, token)).data,
    onSuccess: async value => {
      client.setQueryData(['direct-discussion', token, value.thread.id], value);
      await client.invalidateQueries({ queryKey: ['direct-discussions'] });
    },
  });
  return { list, selectedId: selected, select: setSelectedId, detail, create, post };
}
