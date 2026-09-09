import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSupportReview } from '@/features/support-review/providers/support-review.provider';
import { receivedAgo, reviewBuckets, supportStatuses } from '@/features/support-review/configs/support-review.config';
import { SupportReviewDetail } from '@/features/support-review/components/support-review-detail';

export function AdminSupportReviewPage({ token }: { token: string }): JSX.Element {
  const work = useSupportReview(token);
  const [search, setSearch] = useState(work.filters.q);
  const [showDetail, setShowDetail] = useState(false);
  const { queue, review, filters, selected } = work;
  const page = queue.data?.page ?? filters.page;
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-[#656561]">先评审，再修复。发布单独批准。</p>
      <Button variant="ghost" disabled={queue.isFetching || review.isPending} onClick={() => void queue.refetch()}>刷新反馈</Button>
    </div>
    <div className="flex flex-wrap gap-1" role="group" aria-label="反馈状态">
      {reviewBuckets.map(([key, label]) => <button key={key} type="button" aria-pressed={filters.bucket === key}
        disabled={review.isPending} onClick={() => { work.update({ bucket: key }); setShowDetail(false); }}
        className={'rounded-lg px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ' + (filters.bucket === key ? 'bg-[#e9e5dc] font-semibold text-[#1f1f1d]' : 'text-[#656561] hover:bg-[#f3f2ee]')}>{label}</button>)}
    </div>
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); work.update({ q: search.trim() }); setShowDetail(false); }}>
      <input aria-label="搜索反馈标题或编号" placeholder="搜索标题或反馈编号" value={search} maxLength={100} onChange={event => setSearch(event.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-[#e4e0d7] bg-white px-3 py-2 text-sm outline-none" />
      <Button variant="secondary" disabled={review.isPending}>搜索</Button>
      {filters.q && <Button type="button" variant="ghost" onClick={() => { setSearch(''); work.update({ q: '' }); }}>清除</Button>}
    </form>
    {work.notice && <p role="status" className="rounded-lg bg-[#edf2e6] px-3 py-2 text-sm text-[#425331]">{work.notice}</p>}
    {(queue.error || review.error) && <p role="alert" className="text-sm text-red-700">{(queue.error ?? review.error)?.message}。请刷新后重试。</p>}
    {queue.isLoading ? <p role="status">正在读取反馈…</p> : !queue.data?.items.length ? <div className="rounded-xl border border-dashed border-[#ddd7c8] p-10 text-center">
      <h3 className="font-medium">{filters.q ? '没有匹配的反馈' : '当前队列已清空'}</h3>
      <p className="mt-2 text-sm text-[#656561]">{filters.q ? '试试其它标题或编号，或清除搜索。' : '可切换其它状态查看进展，新反馈会在这里出现。'}</p>
    </div> : <div className="grid overflow-hidden rounded-xl border border-[#e4e0d7] bg-white lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.5fr)]">
      <div className={(showDetail ? 'hidden lg:block ' : '') + 'min-w-0 lg:border-r lg:border-[#e4e0d7]'}>
        <div className="border-b border-[#eeeae1] px-4 py-3 text-xs text-[#8f8a7d]">共 {queue.data.total} 条 · 优先级优先，同级按提交时间</div>
        <ul aria-label="反馈列表" className="divide-y divide-[#eeeae1]">{queue.data.items.map(report => <li key={report.id}>
          <button type="button" aria-current={selected?.id === report.id ? 'true' : undefined} disabled={review.isPending}
            onClick={() => { work.select(report.id); setShowDetail(true); }}
            className={'block w-full space-y-2 px-4 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ' + (selected?.id === report.id ? 'bg-[#f0f1e9]' : 'hover:bg-[#f7f6f2]')}>
            <div className="flex items-center justify-between gap-2 text-xs"><span className={report.priority === 0 ? 'font-semibold text-red-700' : 'text-[#656561]'}>P{report.priority} · {report.approval && report.status === 'received' ? '等待执行' : supportStatuses[report.status]}</span><span className="text-[#8f8a7d]">{receivedAgo(report.createdAt)}</span></div>
            <p className="break-words text-sm font-medium text-[#1f1f1d]">{report.title}</p>
            <p className="line-clamp-2 break-words text-xs leading-5 text-[#656561]">{report.description}</p>
            <p className="text-xs text-[#8f8a7d]">{report.identity === 'verified' ? '已验证用户' : '匿名用户'} · {report.messages.length} 条回复</p>
          </button>
        </li>)}</ul>
        <div className="flex flex-wrap items-center gap-2 border-t border-[#eeeae1] p-3 text-xs">
          <Button variant="ghost" disabled={page <= 1 || review.isPending} onClick={() => work.update({ page: page - 1 })}>上一页</Button>
          <span>{page} / {Math.max(1, Math.ceil(queue.data.total / filters.pageSize))} 页</span>
          <Button variant="ghost" disabled={page * filters.pageSize >= queue.data.total || review.isPending} onClick={() => work.update({ page: page + 1 })}>下一页</Button>
          <select aria-label="每页条数" value={filters.pageSize} disabled={review.isPending} onChange={event => work.update({ pageSize: Number(event.target.value) })} className="rounded border border-[#e4e0d7] bg-white p-1"><option value={10}>10 条 / 页</option><option value={20}>20 条 / 页</option></select>
        </div>
      </div>
      <div className={(showDetail ? '' : 'hidden lg:block ') + 'min-w-0'}>
        <div className="px-4 pt-3 lg:hidden"><Button variant="ghost" onClick={() => setShowDetail(false)}>← 返回列表</Button></div>
        {selected && <SupportReviewDetail key={selected.id} report={selected} maxAuthority={queue.data.maxAuthority} busy={review.isPending}
          body={work.notes[selected.id] ?? ''} setBody={body => work.setNote(selected.id, body)}
          submit={(decision, body) => review.mutate({ report: selected, decision, body })} />}
      </div>
    </div>}
  </section>;
}
