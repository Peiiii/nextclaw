import type { ReactNode } from "react";

export type MetricTableColumn<Row> = {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: Row) => ReactNode;
};

type MetricTableProps<Row> = {
  rows: Row[];
  columns: MetricTableColumn<Row>[];
  rowKey: (row: Row, index: number) => string;
  emptyMessage: string;
};

export function MetricTable<Row>({
  rows,
  columns,
  rowKey,
  emptyMessage
}: MetricTableProps<Row>): JSX.Element {
  if (rows.length === 0) {
    return <p className="metric-table__empty">{emptyMessage}</p>;
  }

  return (
    <div className="metric-table">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={column.align === "right" ? "metric-table__cell--right" : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={column.align === "right" ? "metric-table__cell--right" : undefined}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
