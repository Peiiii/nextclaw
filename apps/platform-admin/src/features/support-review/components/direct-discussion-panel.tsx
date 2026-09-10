import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useDirectDiscussions } from '@/features/support-review/providers/support-review.provider';
import { DirectDiscussionDetail } from './direct-discussion-detail';

export function DirectDiscussionPanel({ token }: { token: string }): JSX.Element {
  const work = useDirectDiscussions(token);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const busy = work.create.isPending || work.post.isPending;
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-[#656561]">从这里直接发起主题，并与已连接的参与端持续对话。</p>
      <div className="flex gap-2"><Button variant="ghost" onClick={() => void work.list.refetch()}>刷新会话</Button><Button onClick={() => setCreating(value => !value)}>发起会话</Button></div>
    </div>
    {creating && <form className="space-y-3 rounded-xl border border-[#e4e0d7] bg-white p-4" onSubmit={event => {
      event.preventDefault();
      void work.create.mutateAsync({ requestId: crypto.randomUUID(), title: title.trim(), body: body.trim() }).then(() => {
        setTitle(''); setBody(''); setCreating(false);
      });
    }}>
      <label className="block text-sm font-medium">标题<input className="mt-2 block w-full rounded-lg border border-[#e4e0d7] px-3 py-2 text-sm" required maxLength={100} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="block text-sm font-medium">消息<Textarea className="mt-2" required rows={5} maxLength={8000} value={body} onChange={event => setBody(event.target.value)} /></label>
      <div className="flex gap-2"><Button disabled={busy || !title.trim() || !body.trim()}>创建并发送</Button><Button type="button" variant="ghost" onClick={() => setCreating(false)}>取消</Button></div>
    </form>}
    {(work.list.error || work.detail.error || work.create.error || work.post.error) && <p role="alert" className="text-sm text-red-700">{(work.list.error ?? work.detail.error ?? work.create.error ?? work.post.error)?.message}</p>}
    {work.list.isLoading ? <p>正在读取对话…</p> : !work.list.data?.items.length ? <div className="rounded-xl border border-dashed border-[#ddd7c8] p-10 text-center"><h3 className="font-medium">还没有直接对话</h3><p className="mt-2 text-sm text-[#656561]">点击“发起会话”，已订阅的参与端会在下一次扫描时收到。</p></div> :
      <div className="grid overflow-hidden rounded-xl border border-[#e4e0d7] bg-white lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.5fr)]">
        <ul className="divide-y divide-[#eeeae1] lg:border-r lg:border-[#e4e0d7]">{work.list.data.items.map(thread => <li key={thread.id}><button type="button" onClick={() => work.select(thread.id)} className={'block w-full px-4 py-4 text-left ' + (work.selectedId === thread.id ? 'bg-[#f0f1e9]' : 'hover:bg-[#f7f6f2]')}><p className="break-words text-sm font-medium">{thread.title}</p><p className="mt-2 text-xs text-[#8f8a7d]">{new Date(thread.updatedAt).toLocaleString()}</p></button></li>)}</ul>
        <div>{work.detail.isLoading ? <p className="p-6">正在读取会话…</p> : work.detail.data && <DirectDiscussionDetail value={work.detail.data} busy={busy} onPost={async message => { await work.post.mutateAsync({ id: work.detail.data!.thread.id, body: message }); }} />}</div>
      </div>}
  </section>;
}
