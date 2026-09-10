import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useDirectDiscussions } from '@/features/support-review/providers/support-review.provider';
import { DirectDiscussionDetail } from './direct-discussion-detail';

export function DirectDiscussionPanel({ token }: { token: string }): JSX.Element {
  const work = useDirectDiscussions(token);
  const [showDetail, setShowDetail] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const busy = work.create.isPending || work.post.isPending;
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-[#656561]">一个主题，一段持续的讨论。</p>
      <div className="flex gap-2"><Button variant="ghost" onClick={() => void work.list.refetch()}>刷新主题</Button><Button onClick={() => setCreating(value => !value)}>新建主题</Button></div>
    </div>
    {creating && <form className="space-y-3 rounded-xl border border-[#e4e0d7] bg-white p-4" onSubmit={event => {
      event.preventDefault();
      if (busy) return;
      void work.create.mutateAsync({ requestId: crypto.randomUUID(), title: title.trim(), body: body.trim() }).then(() => {
        setTitle(''); setBody(''); setCreating(false); setShowDetail(true);
      }).catch(() => undefined);
    }}>
      <label className="block text-sm font-medium">标题<input className="mt-2 block w-full rounded-lg border border-[#e4e0d7] px-3 py-2 text-sm" required disabled={busy} maxLength={100} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="block text-sm font-medium">消息<Textarea className="mt-2" required disabled={busy} rows={5} maxLength={8000} value={body} onChange={event => setBody(event.target.value)} /></label>
      <div className="flex gap-2"><Button disabled={busy || !title.trim() || !body.trim()}>创建并发送</Button><Button type="button" variant="ghost" onClick={() => setCreating(false)}>取消</Button></div>
    </form>}
    {(work.list.error || work.detail.error || work.create.error || work.post.error) && <p role="alert" className="text-sm text-red-700">{(work.list.error ?? work.detail.error ?? work.create.error ?? work.post.error)?.message}</p>}
    {work.list.isLoading ? <p>正在读取对话…</p> : !work.list.data?.items.length ? <div className="rounded-xl border border-dashed border-[#ddd7c8] p-10 text-center"><h3 className="font-medium">还没有直接对话</h3><p className="mt-2 text-sm text-[#656561]">点击“新建主题”，已订阅的参与端会在下一次扫描时收到。</p></div> :
      <div className="grid overflow-hidden rounded-xl border border-[#e4e0d7] bg-white shadow-sm lg:grid-cols-[minmax(220px,0.65fr)_minmax(0,1.7fr)]">
        <ul aria-label="讨论主题" className={(showDetail ? 'hidden lg:block ' : '') + 'max-h-[720px] overflow-y-auto divide-y divide-[#eeeae1] bg-[#fafaf7] lg:border-r lg:border-[#e4e0d7]'}>{work.list.data.items.map(thread => <li key={thread.id}><button type="button" aria-current={work.selectedId === thread.id ? 'true' : undefined} onClick={() => { work.select(thread.id); setShowDetail(true); }} className={'block w-full px-4 py-4 text-left ' + (work.selectedId === thread.id ? 'bg-[#edf0e5] shadow-[inset_3px_0_0_#67744f]' : 'hover:bg-[#f0efe9]')}><p className="break-words text-sm font-medium">{thread.title}</p><p className="mt-2 text-xs text-[#8f8a7d]">{new Date(thread.updatedAt).toLocaleString()}</p></button></li>)}</ul>
        <div className={(showDetail ? '' : 'hidden lg:block ') + 'min-w-0'}>{work.detail.isLoading ? <p className="p-6">正在读取会话…</p> : work.detail.data && <DirectDiscussionDetail key={work.detail.data.thread.id} value={work.detail.data} busy={busy} body={work.drafts[work.detail.data.thread.id] ?? ''} onBody={message => work.setDraft(work.detail.data!.thread.id, message)} onPost={() => work.send(work.detail.data!.thread.id)} onBack={() => setShowDetail(false)} />}</div>
      </div>}
  </section>;
}
