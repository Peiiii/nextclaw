import type { DiscussionActor } from '@nextclaw/shared';

export function DiscussionMessage({ actor, body, createdAt }: {
  actor: DiscussionActor; body: string; createdAt: string;
}): JSX.Element {
  const administrator = actor.authenticated && actor.roles.includes('administrator');
  const role = administrator ? '管理员' : actor.kind === 'agent' ? 'Agent' : actor.kind === 'service' ? '服务' : actor.authenticated ? '已认证用户' : '未认证';
  return <div className="flex min-w-0 gap-3">
    <span aria-hidden="true" className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ' + (actor.kind === 'agent' ? 'bg-[#e9eee2] text-[#425331]' : 'bg-[#eeece6] text-[#656561]')}>
      {actor.kind === 'agent' ? 'AI' : actor.displayName.slice(0, 1).toUpperCase()}
    </span>
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="break-all text-sm font-semibold text-[#1f1f1d]">{actor.displayName}</span>
        <span className="rounded bg-[#f0f1e9] px-1.5 py-0.5 text-[10px] font-medium text-[#566044]">{role}</span>
        <time dateTime={createdAt} title={new Date(createdAt).toLocaleString()} className="text-xs text-[#8f8a7d]">{new Date(createdAt).toLocaleString()}</time>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[#383833] [overflow-wrap:anywhere]">{body}</p>
    </div>
  </div>;
}
