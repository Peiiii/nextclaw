import type { CSSProperties, ReactNode } from 'react';
import { TableWrap } from '@/shared/components/table';
import { cn } from '@/lib/utils';

type DataTableAlign = 'left' | 'center' | 'right';
type DataTableFixedSide = 'left' | 'right';
type DataTableSortDirection = 'asc' | 'desc';

export type DataTableColumn<Row> = {
  key: string;
  title: ReactNode;
  width?: number;
  align?: DataTableAlign;
  fixed?: DataTableFixedSide;
  sortable?: boolean;
  defaultSortDirection?: DataTableSortDirection;
  render: (row: Row) => ReactNode;
};

type DataTableSorting = {
  columnKey: string;
  direction: DataTableSortDirection;
  onChange: (columnKey: string, direction: DataTableSortDirection) => void;
};

type DataTablePaginationLabels = {
  pageSize: string;
  previous: string;
  next: string;
  summary: (from: number, to: number, total: number) => string;
};

type DataTablePagination = {
  page: number;
  pageSize: number;
  total: number;
  pageSizeOptions: number[];
  labels: DataTablePaginationLabels;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  empty: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  minWidth?: number;
  toolbar?: ReactNode;
  sorting?: DataTableSorting;
  pagination?: DataTablePagination;
};

type PageItem = number | 'ellipsis-start' | 'ellipsis-end';

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  empty,
  loading = false,
  loadingLabel,
  minWidth,
  toolbar,
  sorting,
  pagination
}: DataTableProps<Row>): JSX.Element {
  return (
    <div className="space-y-3">
      {toolbar}
      <TableWrap className="max-w-full bg-[var(--color-surface)]">
        <table
          aria-busy={loading}
          className="w-full table-fixed text-left text-sm"
          style={minWidth ? { minWidth } : undefined}
        >
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} style={column.width ? { width: column.width } : undefined} />
            ))}
          </colgroup>
          <thead className="text-xs font-semibold text-[var(--color-foreground-muted)]">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  className={cn(
                    'sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3',
                    alignClassMap[column.align ?? 'left'],
                    column.fixed && 'md:z-30',
                    column.fixed === 'left' && 'border-r border-r-[var(--color-border)] md:left-[var(--data-table-fixed-offset)]',
                    column.fixed === 'right' && 'border-l border-l-[var(--color-border)] md:right-[var(--data-table-fixed-offset)]'
                  )}
                  style={getFixedStyle(columns, index)}
                  scope="col"
                >
                  {column.sortable && sorting ? (
                    <button
                      type="button"
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md outline-none transition-colors hover:text-[var(--color-foreground)] focus-visible:ring-2 focus-visible:ring-brand-200',
                        column.align === 'right' && 'ml-auto'
                      )}
                      onClick={() => {
                        const isActive = sorting.columnKey === column.key;
                        const direction = isActive
                          ? sorting.direction === 'asc' ? 'desc' : 'asc'
                          : column.defaultSortDirection ?? 'asc';
                        sorting.onChange(column.key, direction);
                      }}
                    >
                      {column.title}
                      <span aria-hidden="true" className="text-[10px] text-[var(--color-foreground-subtle)]">
                        {sorting.columnKey === column.key ? sorting.direction === 'asc' ? '↑' : '↓' : '↕'}
                      </span>
                    </button>
                  ) : column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="group border-b border-[var(--color-border-subtle)] last:border-b-0 hover:bg-[var(--color-surface-hover)]">
                {columns.map((column, index) => (
                  <td
                    key={column.key}
                    className={cn(
                      'bg-[var(--color-surface)] px-4 py-3 align-middle text-[var(--color-foreground-muted)] transition-colors group-hover:bg-[var(--color-surface-hover)]',
                      alignClassMap[column.align ?? 'left'],
                      column.fixed && 'md:sticky md:z-10',
                      column.fixed === 'left' && 'border-r border-r-[var(--color-border-subtle)] md:left-[var(--data-table-fixed-offset)]',
                      column.fixed === 'right' && 'border-l border-l-[var(--color-border-subtle)] md:right-[var(--data-table-fixed-offset)]'
                    )}
                    style={getFixedStyle(columns, index)}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {loading && rows.length === 0 ? (
              <tr>
                <td className="px-4 py-12 text-center text-sm text-[var(--color-foreground-subtle)]" colSpan={columns.length}>
                  {loadingLabel}
                </td>
              </tr>
            ) : null}
            {!loading && rows.length === 0 ? (
              <tr>
                <td className="px-4 py-12 text-center text-sm text-[var(--color-foreground-subtle)]" colSpan={columns.length}>
                  {empty}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </TableWrap>
      {pagination ? <DataTablePagination pagination={pagination} /> : null}
    </div>
  );
}

const alignClassMap: Record<DataTableAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right'
};

function getFixedStyle<Row>(columns: DataTableColumn<Row>[], index: number): CSSProperties | undefined {
  const column = columns[index];
  if (!column?.fixed) {
    return undefined;
  }
  const offsetColumns = column.fixed === 'left' ? columns.slice(0, index) : columns.slice(index + 1);
  const offset = offsetColumns
    .filter((candidate) => candidate.fixed === column.fixed)
    .reduce((total, candidate) => total + (candidate.width ?? 0), 0);
  return { '--data-table-fixed-offset': `${offset}px` } as CSSProperties;
}

function DataTablePagination({ pagination }: { pagination: DataTablePagination }): JSX.Element {
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  const currentPage = Math.min(pagination.page, totalPages);
  const from = pagination.total === 0 ? 0 : (currentPage - 1) * pagination.pageSize + 1;
  const to = Math.min(currentPage * pagination.pageSize, pagination.total);

  return (
    <div className="flex flex-col gap-3 text-sm text-[var(--color-foreground-muted)] sm:flex-row sm:items-center sm:justify-between">
      <span>{pagination.labels.summary(from, to, pagination.total)}</span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-foreground-subtle)]">{pagination.labels.pageSize}</span>
          <select
            aria-label={pagination.labels.pageSize}
            className="h-8 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-foreground)] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            value={pagination.pageSize}
            onChange={(event) => pagination.onPageSizeChange(Number(event.target.value))}
          >
            {pagination.pageSizeOptions.map((pageSize) => (
              <option key={pageSize} value={pageSize}>{pageSize}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="h-8 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-xs font-medium text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={currentPage <= 1}
          onClick={() => pagination.onPageChange(currentPage - 1)}
        >
          {pagination.labels.previous}
        </button>
        {getPageItems(currentPage, totalPages).map((item) => typeof item === 'number' ? (
          <button
            key={item}
            type="button"
            aria-current={item === currentPage ? 'page' : undefined}
            className={cn(
              'h-8 min-w-8 rounded-lg border px-2 text-xs font-medium transition-colors',
              item === currentPage
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-muted)]'
            )}
            onClick={() => pagination.onPageChange(item)}
          >
            {item}
          </button>
        ) : (
          <span key={item} className="px-1 text-[var(--color-foreground-subtle)]" aria-hidden="true">…</span>
        ))}
        <button
          type="button"
          className="h-8 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-xs font-medium text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={currentPage >= totalPages || pagination.total === 0}
          onClick={() => pagination.onPageChange(currentPage + 1)}
        >
          {pagination.labels.next}
        </button>
      </div>
    </div>
  );
}

function getPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_item, index) => index + 1);
  }
  const items: PageItem[] = [1];
  if (currentPage > 4) {
    items.push('ellipsis-start');
  }
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }
  if (currentPage < totalPages - 3) {
    items.push('ellipsis-end');
  }
  items.push(totalPages);
  return items;
}
