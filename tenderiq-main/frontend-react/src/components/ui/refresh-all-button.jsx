import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Refresh button with the all-sources progress under it ("7/32 · Mumbai Port Authority · 12 new").
 * Pair it with useRefreshAll(): <RefreshAllButton {...useRefreshAll(reload)} />
 */
export function RefreshAllButton({ refresh, run, isAdmin, listOnly = false, className = '' }) {
  const running = !!run?.running;
  return (
    <div className={`flex shrink-0 flex-col items-end gap-1 ${className}`}>
      <Button
        variant="outline"
        size="md"
        onClick={refresh}
        disabled={running}
        title={isAdmin && !listOnly
          ? 'Fetch new tenders from all sources (GeM, CPPP, eTenders, ports, state portals) and reload'
          : 'Reload this page'}
      >
        <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />
        {running ? 'Refreshing…' : 'Refresh'}
      </Button>
      {running && (
        <p className="max-w-[16rem] truncate text-right text-[11px] text-gray-500" aria-live="polite">
          {run.total ? `${Math.min(run.done + 1, run.total)}/${run.total}` : 'Starting'}
          {run.current ? ` · ${run.current}` : ''}
          {run.newTenders ? ` · ${run.newTenders.toLocaleString()} new` : ''}
        </p>
      )}
    </div>
  );
}
