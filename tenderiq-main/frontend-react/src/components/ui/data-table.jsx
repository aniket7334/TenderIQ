import React from 'react';
import { clsx } from 'clsx';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Spinner } from './spinner';

function DataTable({
  columns,
  data,
  loading = false,
  emptyMessage = 'No data available.',
  onSort,
  currentSort,
  className,
}) {
  const handleSort = (key) => {
    if (!onSort) return;
    const direction =
      currentSort?.key === key && currentSort.direction === 'asc' ? 'desc' : 'asc';
    onSort({ key, direction });
  };

  const renderSortIcon = (columnKey) => {
    if (!currentSort || currentSort.key !== columnKey) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />;
    }
    return currentSort.direction === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500',
                  col.sortable && 'cursor-pointer select-none hover:text-gray-700',
                )}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <div className="flex items-center gap-1.5">
                  {col.label}
                  {col.sortable && renderSortIcon(col.key)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-sm text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="transition-colors hover:bg-gray-50"
              >
                {columns.map((col) => (
                  <td key={col.key} className="whitespace-nowrap px-4 py-3 text-gray-700">
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
