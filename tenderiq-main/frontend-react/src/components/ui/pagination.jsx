import React from 'react';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  className,
}) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    if (currentPage > 3) {
      pages.push('...');
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push('...');
    }

    pages.push(totalPages);

    return pages;
  };

  return (
    <div className={clsx('flex items-center justify-between', className)}>
      <p className="text-sm text-gray-500">
        Page {currentPage} of {totalPages}
      </p>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="inline-flex items-center rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {getPageNumbers().map((page, idx) =>
          page === '...' ? (
            <span
              key={`ellipsis-${idx}`}
              className="px-2 text-sm text-gray-400"
            >
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={clsx(
                'inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium',
                page === currentPage
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100',
              )}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </button>
          ),
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="inline-flex items-center rounded-lg p-2 text-sm text-gray-500 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
};

export { Pagination };
