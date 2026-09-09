import { useState } from 'react';
import type { AdminProductActivityOverview } from '@/features/admin-overview/types/product-activity.types';

type TrendItem = AdminProductActivityOverview['trend'][number];

export function ProductActivityTrend(props: {
  trend: AdminProductActivityOverview['trend'];
}): JSX.Element {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  if (props.trend.length === 0) {
    return <p className="rounded-xl bg-[#f5f3ee] px-4 py-5 text-sm text-[#8f8a7d]">暂无趋势数据。</p>;
  }

  const selectedItem = props.trend.find((item) => item.date === selectedDate) ?? props.trend[props.trend.length - 1]!;
  const maximum = Math.max(1, ...props.trend.flatMap((item) => [item.active, item.successful]));
  const midpoint = maximum / 2;

  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-[#e4e0d7] bg-[#f9f8f5] px-4 py-3 text-sm"
        data-testid="product-activity-trend-detail"
      >
        <span className="font-semibold text-[#1f1f1d]">{formatTrendDate(selectedItem.date)}</span>
        <span className="font-medium text-[#315fbf]">活跃 {formatCount(selectedItem.active)}</span>
        <span className="font-medium text-[#24784d]">成功 {formatCount(selectedItem.successful)}</span>
        <span className="ml-auto text-xs text-[#8f8a7d]">悬停、聚焦或点击日期可查看详情</span>
      </div>

      <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2">
        <div
          className="relative mt-1 h-32 text-right text-[10px] tabular-nums text-[#8f8a7d]"
          aria-label={`Y 轴刻度：${maximum}、${midpoint}、0`}
          data-testid="product-activity-trend-axis"
        >
          <span className="absolute right-0 top-0 -translate-y-1/2">{formatCount(maximum)}</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2">{formatCount(midpoint)}</span>
          <span className="absolute bottom-0 right-0 translate-y-1/2">0</span>
        </div>

        <div className="overflow-x-auto pb-1" data-testid="product-activity-trend-scroller">
          <div className="relative min-w-[720px] pt-1">
            <div className="pointer-events-none absolute inset-x-0 top-1 h-32" aria-hidden="true">
              <span className="absolute inset-x-0 top-0 border-t border-dashed border-[#d8d3c8]" />
              <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-[#e4e0d7]" />
              <span className="absolute inset-x-0 bottom-0 border-t border-[#d8d3c8]" />
            </div>

            <ol className="relative flex h-40 items-start gap-1" aria-label="最近 30 日产品活跃趋势">
              {props.trend.map((item) => (
                <ProductActivityTrendDay
                  key={item.date}
                  item={item}
                  maximum={maximum}
                  isSelected={item.date === selectedItem.date}
                  onSelect={setSelectedDate}
                />
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductActivityTrendDay(props: {
  item: TrendItem;
  maximum: number;
  isSelected: boolean;
  onSelect: (date: string) => void;
}): JSX.Element {
  const { item } = props;
  const accessibleLabel = `${item.date}：活跃 ${item.active}，成功 ${item.successful}`;
  return (
    <li className="h-40 min-w-0 flex-1">
      <button
        type="button"
        className="group flex h-full w-full min-w-0 flex-col items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#2f6fed] focus-visible:ring-offset-2"
        aria-label={accessibleLabel}
        aria-pressed={props.isSelected}
        data-testid={`product-activity-day-${item.date}`}
        onMouseEnter={() => props.onSelect(item.date)}
        onFocus={() => props.onSelect(item.date)}
        onClick={() => props.onSelect(item.date)}
      >
        <span
          className={`flex h-32 w-full items-end justify-center gap-px rounded-t border px-px transition-colors ${
            props.isSelected
              ? 'border-[#b9c9ee] bg-[#eaf0fc]'
              : 'border-transparent bg-[#f5f3ee] group-hover:border-[#d8d3c8] group-hover:bg-[#efede7]'
          }`}
          aria-hidden="true"
        >
          <span
            className="w-1/2 rounded-t bg-[#4f7ee8]"
            style={{ height: `${(item.active / props.maximum) * 100}%`, minHeight: item.active > 0 ? 3 : 0 }}
          />
          <span
            className="w-1/2 rounded-t bg-[#39a36d]"
            style={{ height: `${(item.successful / props.maximum) * 100}%`, minHeight: item.successful > 0 ? 3 : 0 }}
          />
        </span>
        <span className={`text-[10px] tabular-nums ${props.isSelected ? 'font-semibold text-[#315fbf]' : 'text-[#8f8a7d]'}`}>
          {item.date.slice(8)}
        </span>
      </button>
    </li>
  );
}

function formatTrendDate(date: string): string {
  const [year = '', month = '', day = ''] = date.split('-');
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}
