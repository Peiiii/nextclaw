import { useState } from 'react';
import type { DiscussionThreadView } from '@nextclaw/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { discussionActorLabel } from '@/features/support-review/configs/support-review.config';

export function DirectDiscussionDetail({ value, busy, onPost }: {
  value: DiscussionThreadView;
  busy: boolean;
  onPost: (body: string) => Promise<void>;
}): JSX.Element {
  const [body, setBody] = useState('');
  return <article className="space-y-5 p-4 sm:p-6">
    <header>
      <p className="mb-2 text-xs text-[#8f8a7d]">直接对话 · {value.posts.length} 条消息</p>
      <h3 className="break-words text-xl font-semibold leading-7">{value.thread.title}</h3>
      <p className="mt-2 text-xs text-[#656561]">由 {discussionActorLabel(value.thread.openedBy)} 发起 · {new Date(value.thread.createdAt).toLocaleString()}</p>
    </header>
    <ol className="space-y-4 border-t border-[#eeeae1] pt-4">{value.posts.map(post => <li key={post.id}>
      <p className="text-xs text-[#8f8a7d]">{discussionActorLabel(post.author)} · {new Date(post.createdAt).toLocaleString()}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{post.body}</p>
    </li>)}</ol>
    <form className="space-y-3 border-t border-[#eeeae1] pt-4" onSubmit={event => {
      event.preventDefault();
      const message = body.trim();
      if (!message) return;
      void onPost(message).then(() => setBody(''));
    }}>
      <label className="block text-sm font-medium">继续对话
        <Textarea rows={4} maxLength={4000} required value={body} onChange={event => setBody(event.target.value)} className="mt-2" />
      </label>
      <p className="text-xs text-[#656561]">这条消息会以已认证管理员身份发布，并唤醒已订阅的参与端。</p>
      <Button disabled={busy || !body.trim()}>发送</Button>
    </form>
  </article>;
}
