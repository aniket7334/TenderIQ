import React from 'react';
import { clsx } from 'clsx';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Spinner } from './spinner';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  render?: (value: any, row: T, index: number) => React.ReactNode;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface DataTableProps<T extends Record<string, any>> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onSort?: (sort: SortConfig) => void;
  currentSort?: SortConfig;
  className?: string;
  onRowClick?: (row: T) => void;
}

function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No records on the desk.',
  onSort,
  currentSort,
  className,
  onRowClick,
}: DataTableProps<T>) {
  const handleSort = (key: string) => {
    if (!onSort) return;
    const direction =
      currentSort?.key === key && currentSort.direction === 'asc' ? 'desc' : 'asc';
    onSort({ key, direction });
  };

  const renderSortIcon = (columnKey: string) => {
    if (!currentSort || currentSort.key !== columnKey) {
      return <ArrowUpDown className="h-3 w-3 text-ink-muted/60" />;
    }
    return currentSort.direction === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-brass" />
    ) : (
      <ArrowDown className="h-3 w-3 text-brass" />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-rule bg-paper-tint/60">
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  'whitespace-nowrap px-5 py-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  col.sortable && 'cursor-pointer select-none hover:text-ink',
                )}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span
                  className={clsx(
                    'inline-flex items-center gap-1.5',
                    col.align === 'right' && 'justify-end',
                    col.align === 'center' && 'justify-center',
                  )}
                >
                  {col.label}
                  {col.sortable && renderSortIcon(col.key)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-5 py-16 text-center text-[13px] text-ink-muted"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={clsx(
                  'border-b border-rule-soft text-[13px] text-ink-soft transition-colors last:border-b-0',
                  onRowClick && 'cursor-pointer hover:bg-canvas-tint',
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      'whitespace-nowrap px-5 py-3.5',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                    )}
                  >
                    {col.render
                      ? col.render(row[col.key], row, rowIndex)
                      : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export { DataTable };
