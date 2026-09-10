import { useState } from 'react';
import { DiscussionMessage } from './discussion-message';
import type { SupportReport, SupportReviewDecision } from '@nextclaw/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { reviewLabels, supportStatuses } from '@/features/support-review/configs/support-review.config';

export function SupportReviewDetail({ report, maxAuthority, busy, submit, body, setBody }: {
  report: SupportReport; maxAuthority: string; busy: boolean; submit: (decision: SupportReviewDecision, body: string) => void;
  body: string; setBody: (body: string) => void;
}): JSX.Element {
  const [error, setError] = useState('');
  const [confirmRelease, setConfirmRelease] = useState(false);
  const approved = report.approval?.inputVersion === report.inputVersion;
  const reviewable = !['withdrawn', 'published', 'resolved'].includes(report.status);
  const repairable = reviewable && report.status !== 'working' && report.status !== 'ready' && !approved;
  const act = (decision: SupportReviewDecision) => {
    if (['needs-info', 'reject'].includes(decision) && !body.trim()) { setError('请填写需要用户补充的信息或不处理的原因。'); return; }
    setError(''); setConfirmRelease(false); submit(decision, body);
  };
  return <article aria-label="反馈详情" className="space-y-5 p-4 sm:p-6">
    <header><p className="mb-2 text-xs text-[#8f8a7d]">{supportStatuses[report.status]} · P{report.priority}</p>
      <h3 className="break-words text-xl font-semibold leading-7">{report.title}</h3>
      <p className="mt-2 text-xs text-[#656561]">{report.identity === 'verified' ? '已验证用户' : '匿名用户'} · {new Date(report.createdAt).toLocaleString()}</p>
    </header>
    <p className="whitespace-pre-wrap break-words text-sm leading-6">{report.description}</p>
    {(report.environment || report.version) && <div className="rounded-lg bg-[#f7f6f2] p-3 text-sm"><p>版本：{report.version || '未提供'}</p><p className="mt-1 break-words">环境：{report.environment || '未提供'}</p></div>}
    {report.evidence && <section><h4 className="mb-2 text-sm font-semibold">修复与验证证据</h4><p className="whitespace-pre-wrap break-words text-sm leading-6">{report.evidence}</p></section>}
    {report.relatedUrl && <a className="block text-sm underline" href={report.relatedUrl} target="_blank" rel="noreferrer">查看关联产物 ↗</a>}
    {report.release && <a className="block text-sm underline" href={report.release.url} target="_blank" rel="noreferrer">已发布 {report.release.version} · {report.release.channel} ↗</a>}
    <section className="border-t border-[#eeeae1] pt-4"><h4 className="mb-3 text-sm font-semibold">讨论 · {report.messages.length}</h4>
      {!report.messages.length && <p className="text-sm text-[#8f8a7d]">暂无补充或回复。</p>}
      <ol className="space-y-6">{report.messages.map(message => <li key={message.id}><DiscussionMessage actor={message.actor} body={message.body} createdAt={message.createdAt} /></li>)}</ol>
    </section>
    {reviewable && <section className="space-y-3 border-t border-[#eeeae1] pt-4">
      <div><h4 className="text-sm font-semibold">评审处理</h4><p className="mt-1 text-xs text-[#656561]">{approved ? reviewLabels[report.approval!.authority] : '尚未批准执行'} · 处理成功后继续下一条</p></div>
      <label className="block text-sm">回复或评审意见<span className="ml-1 text-xs text-[#8f8a7d]">（要求补充、不处理时必填）</span>
        <Textarea rows={3} maxLength={4000} value={body} onChange={event => setBody(event.target.value)} className="mt-2" />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {maxAuthority === 'analyze' && <p className="text-xs text-[#656561]">当前环境仅允许评审，尚未开放自动修复。</p>}
      <div className="flex flex-wrap gap-2">
        {repairable && <Button disabled={busy || maxAuthority === 'analyze'} onClick={() => act('repair')}>批准修复</Button>}
        <Button variant="secondary" disabled={busy} onClick={() => act('needs-info')}>要求补充</Button>
        <Button variant="ghost" disabled={busy} onClick={() => act('reject')}>不处理</Button>
        {approved && <Button variant="ghost" disabled={busy} onClick={() => act('revoke')}>撤销批准</Button>}
      </div>
      {repairable && <p className="text-xs text-[#8f8a7d]">只批准修复；验证完成后，在“待发布”中决定是否发布。</p>}
      {report.status === 'ready' && report.approval?.authority !== 'deliver' && <div className="rounded-lg bg-[#f7f6f2] p-3">
        <p className="mb-2 text-sm">发布审批</p><p className="mb-3 text-xs text-[#656561]">确认修复证据后批准发布。实际发布仍须通过交付验证。</p>
        {!confirmRelease ? <Button variant="secondary" disabled={busy || maxAuthority !== 'deliver'} onClick={() => setConfirmRelease(true)}>批准发布…</Button> :
          <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => act('deliver')}>确认批准发布</Button><Button variant="ghost" onClick={() => setConfirmRelease(false)}>取消</Button></div>}
        {maxAuthority !== 'deliver' && <p className="mt-2 text-xs text-[#656561]">当前环境尚未开放发布授权。</p>}
      </div>}
    </section>}
    <details className="text-xs text-[#8f8a7d]"><summary className="cursor-pointer">反馈编号</summary><p className="mt-2 break-all">{report.id}</p></details>
  </article>;
}
