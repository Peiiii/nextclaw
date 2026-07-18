import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DataTableSortDirection = 'asc' | 'desc';

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  render: (item: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: number;
  minWidth?: number;
  sticky?: 'left' | 'right';
  sortable?: boolean;
  className?: string;
};

type Props<T> = {
  columns: Array<DataTableColumn<T>>;
  items: T[];
  rowKey: (item: T) => string;
  emptyContent: ReactNode;
  isLoading?: boolean;
  minWidth?: number;
  sortBy?: string;
  sortDirection?: DataTableSortDirection;
  onSort?: (columnKey: string) => void;
};

export function DataTable<T>({
  columns,
  items,
  rowKey,
  emptyContent,
  isLoading = false,
  minWidth = 960,
  sortBy,
  sortDirection,
  onSort,
}: Props<T>): JSX.Element {
  return (
    <div className="overflow-auto rounded-xl border border-[#e4e0d7] bg-white">
      <table className="w-full border-separate border-spacing-0 text-left text-sm" style={{ minWidth }}>
        <thead className="sticky top-0 z-20 bg-[#f5f3ee] text-xs font-semibold uppercase tracking-[0.08em] text-[#7b766b]">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                aria-sort={readAriaSort(column, sortBy, sortDirection)}
                className={cn(
                  'border-b border-[#ddd8cd] px-4 py-3',
                  alignmentClassName(column.align),
                  stickyColumnClassName(column.sticky, true),
                  column.className,
                )}
                style={columnStyle(column)}
              >
                {column.sortable && onSort ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md text-left transition-colors hover:text-[#1f1f1d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
                    onClick={() => onSort(column.key)}
                  >
                    <span>{column.header}</span>
                    <span aria-hidden="true" className="text-[11px] text-[#aaa394]">
                      {sortIcon(column.key, sortBy, sortDirection)}
                    </span>
                  </button>
                ) : column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? <LoadingRows columns={columns} /> : null}
          {!isLoading && items.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-14 text-center text-sm text-[#8f8a7d]">
                {emptyContent}
              </td>
            </tr>
          ) : null}
          {!isLoading ? items.map((item) => (
            <tr key={rowKey(item)} className="group transition-colors hover:bg-[#faf9f6]">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'border-b border-[#eeeae1] px-4 py-3.5 align-middle group-last:border-b-0',
                    alignmentClassName(column.align),
                    stickyColumnClassName(column.sticky, false),
                    column.className,
                  )}
                  style={columnStyle(column)}
                >
                  {column.render(item)}
                </td>
              ))}
            </tr>
          )) : null}
        </tbody>
      </table>
    </div>
  );
}

function LoadingRows<T>({ columns }: { columns: Array<DataTableColumn<T>> }): JSX.Element {
  return (
    <>
      {Array.from({ length: 6 }, (_item, rowIndex) => (
        <tr key={`loading-${rowIndex}`}>
          {columns.map((column) => (
            <td
              key={column.key}
              className={cn(
                'border-b border-[#eeeae1] px-4 py-4',
                stickyColumnClassName(column.sticky, false),
              )}
              style={columnStyle(column)}
            >
              <span className="block h-4 animate-pulse rounded bg-[#ebe7de]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function readAriaSort<T>(
  column: DataTableColumn<T>,
  sortBy: string | undefined,
  sortDirection: DataTableSortDirection | undefined,
): 'ascending' | 'descending' | 'none' | undefined {
  if (!column.sortable) {
    return undefined;
  }
  if (column.key !== sortBy) {
    return 'none';
  }
  return sortDirection === 'asc' ? 'ascending' : 'descending';
}

function sortIcon(
  columnKey: string,
  sortBy: string | undefined,
  sortDirection: DataTableSortDirection | undefined,
): string {
  if (columnKey !== sortBy) {
    return '↕';
  }
  return sortDirection === 'asc' ? '↑' : '↓';
}

function columnStyle<T>(column: DataTableColumn<T>): CSSProperties {
  return {
    width: column.width,
    minWidth: column.minWidth,
  };
}

function alignmentClassName(align: DataTableColumn<unknown>['align']): string {
  if (align === 'right') {
    return 'text-right';
  }
  if (align === 'center') {
    return 'text-center';
  }
  return 'text-left';
}

function stickyColumnClassName(sticky: DataTableColumn<unknown>['sticky'], isHeader: boolean): string {
  if (sticky === 'left') {
    return cn('lg:sticky lg:left-0', isHeader ? 'z-30 bg-[#f5f3ee]' : 'z-10 bg-white group-hover:bg-[#faf9f6]');
  }
  if (sticky === 'right') {
    return cn(
      'lg:sticky lg:right-0',
      isHeader
        ? 'z-30 bg-[#f5f3ee] shadow-[-8px_0_14px_-12px_rgba(31,31,29,0.45)]'
        : 'z-10 bg-white shadow-[-8px_0_14px_-12px_rgba(31,31,29,0.32)] group-hover:bg-[#faf9f6]',
    );
  }
  return '';
}
