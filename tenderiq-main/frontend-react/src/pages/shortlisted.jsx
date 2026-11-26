import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { ArrowRight, Loader2, RefreshCw, Star, StarOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import useAuth, { canEditTenders } from '@/hooks/useAuth';

/* Shortlisted tenders: everything starred on the Tenders list or the tender
   page (status "interested"). Classic style — navy/grey, no status colours. */

const PAGE_SIZE = 20;
const SORTS = [
  { value: 'submission_deadline:asc', label: 'Closing soonest' },
  { value: 'created_at:desc', label: 'Newest first' },
  { value: 'estimated_value:desc', label: 'Highest value' },
];

const daysUntil = (d) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((b - a) / 86400000);
};

function deadlineText(d) {
  const days = daysUntil(d);
  if (days === null) return '';
  if (days < 0) return 'Closed';
  if (days === 0) return 'Closes today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

export default function ShortlistedPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState(SORTS[0].value);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(null);
  const canEdit = canEditTenders(useAuth((s) => s.user));

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [sort_by, sort_order] = sort.split(':');
      const res = await api.get('/tenders', {
        params: { internal_status: 'interested', page, page_size: PAGE_SIZE, sort_by, sort_order },
      });
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load shortlisted tenders');
    } finally {
      setLoading(false);
    }
  }, [page, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const removeFromShortlist = async (tender) => {
    try {
      setRemoving(tender.id);
      await api.patch(`/tenders/${tender.id}`, { internal_status: 'new' });
      setItems((prev) => prev.filter((t) => t.id !== tender.id));
      setTotal((n) => Math.max(0, n - 1));
      toast.success('Removed from shortlist');
    } catch {
      // the API helper reports errors
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Shortlisted</h1>
          <p className="mt-1 text-sm text-gray-500">
            {loading && !items.length ? 'Loading…' : `${total.toLocaleString()} tender${total === 1 ? '' : 's'} marked for follow-up`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-brand-400 focus:outline-none"
            aria-label="Sort shortlisted tenders"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <Button variant="outline" size="md" onClick={load} title="Reload">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white">
        {loading && !items.length ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-brand-700" />
          </div>
        ) : error ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm text-gray-600">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={load}>
              Try again
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200">
              <Star className="h-5 w-5 text-gray-400" />
            </span>
            <p className="mt-4 text-base font-medium text-gray-900">No shortlisted tenders yet</p>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              Click the star on any tender in the Tenders list, or "Shortlist" on a tender's page, and it will appear here.
            </p>
            <Link to="/tenders" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
              Browse tenders <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <ul className={clsx('divide-y divide-gray-100', loading && 'opacity-60')}>
            {items.map((t) => {
              const deadline = t.submission_deadline || t.submission_end_date;
              const days = deadline ? daysUntil(deadline) : null;
              const value = t.estimated_value
                ? formatCurrency(t.estimated_value, t.currency || t.estimated_cost_currency || 'INR')
                : null;
              return (
                <li key={t.id} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-gray-50">
                  <Link to={`/tenders/${t.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900" title={t.title}>
                      {t.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {[t.organization, t.source_name, t.reference_number].filter(Boolean).join(' · ')}
                    </p>
                    {/* phone: deadline + value under the title */}
                    <p className="mt-1 text-xs text-gray-500 sm:hidden">
                      {[deadline && deadlineText(deadline), value].filter(Boolean).join(' · ')}
                    </p>
                  </Link>
                  <div className="hidden w-40 flex-shrink-0 text-right sm:block">
                    {value && <p className="text-sm font-medium text-gray-900">{value}</p>}
                    {deadline && (
                      <p className={clsx('text-xs', days !== null && days >= 0 && days <= 1 ? 'font-semibold text-gray-900' : 'text-gray-500')}>
                        {deadlineText(deadline)} · {formatDate(deadline, 'd MMM yyyy')}
                      </p>
                    )}
                  </div>
                  {canEdit && <button
                    type="button"
                    onClick={() => removeFromShortlist(t)}
                    disabled={removing === t.id}
                    title="Remove from shortlist"
                    aria-label="Remove from shortlist"
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:border-gray-300 hover:bg-white hover:text-gray-900 disabled:opacity-50"
                  >
                    {removing === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <StarOff className="h-4 w-4" />}
                  </button>}
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm">
            <span className="text-gray-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
