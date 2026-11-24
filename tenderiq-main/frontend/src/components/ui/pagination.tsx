import React from 'react';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className,
}) => {
  if (totalPages <= 1) return null;

  const getPageNumbers = (): (number | '...')[] => {
    const pages: (number | '...')[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);
    if (currentPage > 3) pages.push('...');

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className={clsx('flex items-center justify-between', className)}>
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
        Folio {currentPage} / {totalPages}
      </p>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="inline-flex items-center p-2 text-ink-soft hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {getPageNumbers().map((page, idx) =>
          page === '...' ? (
            <span
              key={`ellipsis-${idx}`}
              className="px-2 font-mono text-[12px] text-ink-muted"
            >
              …
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={clsx(
                'inline-flex h-8 w-8 items-center justify-center font-mono text-[12.5px] tabular-nums transition-colors',
                page === currentPage
                  ? 'bg-ink text-paper'
                  : 'text-ink-soft hover:bg-canvas-tint hover:text-ink',
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
          className="inline-flex items-center p-2 text-ink-soft hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
};

export { Pagination };
