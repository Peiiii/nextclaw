import { useLayoutEffect, useRef, useState } from 'react';
import type { DiscussionThreadView } from '@nextclaw/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { DiscussionMessage } from './discussion-message';

export function DirectDiscussionDetail({ value, busy, body, onBody, onPost, onBack }: {
  value: DiscussionThreadView; busy: boolean; body: string;
  onBody: (body: string) => void; onPost: () => Promise<void>; onBack: () => void;
}): JSX.Element {
  const viewport = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [away, setAway] = useState(false);
  const latest = value.posts[value.posts.length - 1]?.id;
  const showLatest = () => {
    if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
    following.current = true; setAway(false);
  };
  useLayoutEffect(() => {
    if (following.current && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [latest]);
  return <article aria-label="主题对话" className="flex h-[calc(100dvh-240px)] min-h-[360px] min-w-0 flex-col lg:h-[min(720px,calc(100dvh-280px))]">
    <header className="shrink-0 border-b border-[#eeeae1] px-5 py-4">
      <button type="button" onClick={onBack} className="mb-2 text-sm text-[#656561] lg:hidden">← 返回主题</button>
      <h3 className="break-words text-lg font-semibold leading-7">{value.thread.title}</h3>
      <p className="mt-1 text-xs text-[#8f8a7d]">私密讨论 · {value.posts.length} 条消息 · 回复自动更新</p>
    </header>
    <div ref={viewport} aria-label="消息记录" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6" onScroll={event => {
      const element = event.currentTarget;
      following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64;
      setAway(!following.current);
    }}>
      <ol className="space-y-7">{value.posts.map(post => <li key={post.id}>
        <DiscussionMessage actor={post.author} body={post.body} createdAt={post.createdAt} />
      </li>)}</ol>
    </div>
    {away && <button type="button" onClick={showLatest} className="shrink-0 border-t border-[#eeeae1] bg-[#f7f8f2] py-2 text-xs text-[#425331]">↓ 查看最新消息</button>}
    <form className="shrink-0 border-t border-[#eeeae1] bg-[#fafaf7] p-4" onSubmit={event => {
      event.preventDefault();
      if (!busy && body.trim()) void onPost().then(showLatest).catch(() => undefined);
    }}>
      <label className="sr-only" htmlFor="discussion-reply">回复当前主题</label>
      <Textarea id="discussion-reply" rows={3} maxLength={4000} disabled={busy} value={body} placeholder="继续讨论，或告诉参与者下一步要做什么…" onChange={event => onBody(event.target.value)}
        className="resize-none bg-white" onKeyDown={event => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {
            event.preventDefault(); event.currentTarget.form?.requestSubmit();
          }
        }} />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-[#8f8a7d]">以管理员身份发送<span className="hidden sm:inline"> · Ctrl / ⌘ + Enter</span></p>
        <Button disabled={busy || !body.trim()}>{busy ? '发送中…' : '发送'}</Button>
      </div>
    </form>
  </article>;
}
