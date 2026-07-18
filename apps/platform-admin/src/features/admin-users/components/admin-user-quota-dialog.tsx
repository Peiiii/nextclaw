import type { UserView } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatUsd } from '@/lib/utils';

type Props = {
  user: UserView;
  freeLimitDraft: string;
  paidBalanceDeltaDraft: string;
  validationMessage: string | null;
  mutationErrorMessage: string | null;
  isSaving: boolean;
  canSave: boolean;
  onFreeLimitDraftChange: (value: string) => void;
  onPaidBalanceDeltaDraftChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

export function AdminUserQuotaDialog(props: Props): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f1f1d]/35 px-4 py-8 backdrop-blur-[2px]">
      <section
        aria-labelledby="admin-user-quota-dialog-title"
        aria-modal="true"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#ddd8cd] bg-white shadow-[0_24px_80px_rgba(31,31,29,0.24)]"
        role="dialog"
      >
        <header className="border-b border-[#e7e2d8] px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f8a7d]">User quota</p>
          <h3 id="admin-user-quota-dialog-title" className="mt-1 text-lg font-semibold text-[#1f1f1d]">管理用户额度</h3>
          <p className="mt-1 truncate text-sm text-[#656561]" title={props.user.email}>{props.user.email}</p>
        </header>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <QuotaSnapshot label="免费已用" value={formatUsd(props.user.freeUsedUsd)} />
            <QuotaSnapshot label="免费剩余" value={formatUsd(props.user.freeRemainingUsd)} />
            <QuotaSnapshot label="付费余额" value={formatUsd(props.user.paidBalanceUsd)} />
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[#34332f]">免费额度上限</span>
            <Input
              inputMode="decimal"
              value={props.freeLimitDraft}
              onChange={(event) => props.onFreeLimitDraftChange(event.target.value)}
            />
            <span className="block text-xs leading-5 text-[#7b766b]">填写新的绝对上限，必须大于等于 0。</span>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[#34332f]">付费余额增减</span>
            <Input
              inputMode="decimal"
              placeholder="例如 10 或 -5；留空表示不调整"
              value={props.paidBalanceDeltaDraft}
              onChange={(event) => props.onPaidBalanceDeltaDraftChange(event.target.value)}
            />
            <span className="block text-xs leading-5 text-[#7b766b]">正数增加余额，负数扣减余额；保存前请核对金额。</span>
          </label>

          {props.validationMessage ? <p className="text-sm text-rose-600" role="alert">{props.validationMessage}</p> : null}
          {props.mutationErrorMessage ? <p className="text-sm text-rose-600" role="alert">{props.mutationErrorMessage}</p> : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[#e7e2d8] bg-[#faf9f6] px-6 py-4">
          <Button variant="ghost" disabled={props.isSaving} onClick={props.onCancel}>取消</Button>
          <Button disabled={!props.canSave || props.isSaving} onClick={props.onSave}>
            {props.isSaving ? '保存中...' : '确认保存'}
          </Button>
        </footer>
      </section>
    </div>
  );
}

function QuotaSnapshot({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-xl bg-[#f6f3ec] px-3 py-3">
      <p className="text-xs text-[#7b766b]">{label}</p>
      <p className="mt-1 font-semibold tabular-nums text-[#1f1f1d]">{value}</p>
    </div>
  );
}
