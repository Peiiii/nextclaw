import { Button } from '@/components/ui/button';

type Props = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function AdminUserPagination(props: Props): JSX.Element {
  const from = props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1;
  const to = props.total === 0 ? 0 : Math.min(props.total, from + props.pageSize - 1);
  return (
    <div className="flex flex-col gap-3 text-sm text-[#656561] sm:flex-row sm:items-center sm:justify-between">
      <p className="tabular-nums">{from}–{to} / 共 {props.total} 位用户</p>
      <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
        <label className="flex items-center gap-2">
          <span>每页</span>
          <select
            aria-label="每页用户数"
            className="h-8 rounded-lg border border-[#d9d3c5] bg-white px-2 text-sm text-[#1f1f1d] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            value={props.pageSize}
            onChange={(event) => props.onPageSizeChange(Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option} 条</option>)}
          </select>
        </label>
        <span className="text-right tabular-nums sm:min-w-[76px] sm:text-center">
          {props.totalPages === 0 ? '0 / 0' : `${props.page} / ${props.totalPages}`}
        </span>
        <Button
          variant="ghost"
          className="h-9 px-3 sm:h-8"
          disabled={props.page <= 1}
          onClick={() => props.onPageChange(props.page - 1)}
        >
          上一页
        </Button>
        <Button
          variant="secondary"
          className="h-9 px-3 sm:h-8"
          disabled={props.totalPages === 0 || props.page >= props.totalPages}
          onClick={() => props.onPageChange(props.page + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
