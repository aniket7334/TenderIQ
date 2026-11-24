'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Star,
  Loader2,
  AlertTriangle,
  RefreshCw,
  X,
  ArrowUpRight,
} from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';
import api from '@/lib/api';
import {
  formatCurrencyShort,
  formatCountdown,
  getStatusColor,
  getStatusLabel,
} from '@/lib/utils';
import type { Tender, PaginatedResponse, TenderFilters, Source } from '@/lib/types';

/* ──────────────────────────────────────────────────────────────
   Options
   ────────────────────────────────────────────────────────────── */

const STATUS_OPTIONS = [
  { value: '',             label: 'All statuses' },
  { value: 'new',          label: 'New' },
  { value: 'interested',   label: 'Shortlisted' },
  { value: 'scraped',      label: 'Reviewed' },
  { value: 'submitted',    label: 'Submitted' },
  { value: 'awarded',      label: 'Awarded' },
  { value: 'closed',       label: 'Closed' },
];

const CATEGORY_OPTIONS = [
  'All', 'Port', 'Jetty', 'Wharf', 'Breakwater', 'Harbour', 'Dredging',
  'Maritime', 'Dock', 'Berth', 'Shipping', 'Cargo', 'Vessel',
  'Tugboat', 'Navigation', 'Coastal', 'Waterway', 'Shipbuilding',
  'Ship Repair', 'Railway', 'Construction', 'Road',
  'Maintenance', 'Consultancy', 'Procurement',
];

/* ──────────────────────────────────────────────────────────────
   Page body
   ────────────────────────────────────────────────────────────── */

function TendersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [filters, setFilters] = useState<TenderFilters>({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    source_id: searchParams.get('source_id') ? Number(searchParams.get('source_id')) : undefined,
    state: searchParams.get('state') || '',
    date_from: searchParams.get('date_from') || '',
    date_to: searchParams.get('date_to') || '',
    page: Number(searchParams.get('page')) || 1,
    page_size: 20,
    sort_by: searchParams.get('sort_by') || 'created_at',
    sort_order: (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc',
  });

  const fetchTenders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number | boolean> = {};
      if (filters.search) params.search = filters.search;
      if (filters.status) params.internal_status = filters.status;
      if (filters.source_id) params.source_id = filters.source_id;
      if (filters.state) params.state = filters.state;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (selectedCategory) params.category = selectedCategory;
      params.page = filters.page || 1;
      params.page_size = filters.page_size || 20;
      if (filters.sort_by) params.sort_by = filters.sort_by;
      if (filters.sort_order) params.sort_order = filters.sort_order;

      const res = await api.get<PaginatedResponse<Tender>>('/tenders', { params });
      const uniqueTenders = Array.from(
        new Map((res.data.items ?? []).map((t) => [t.id, t])).values(),
      );
      setTenders(uniqueTenders);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load tenders';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters, selectedCategory]);

  const fetchSources = useCallback(async () => {
    try {
      const res = await api.get('/sources');
      setSources(res.data.items || res.data || []);
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => { fetchTenders(); }, [fetchTenders]);
  useEffect(() => { fetchSources(); }, [fetchSources]);

  const updateFilter = (key: keyof TenderFilters, value: string | number | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: key === 'page' ? (value as number) : 1 }));
  };

  const handleSort = (column: string) => {
    setFilters((prev) => ({
      ...prev,
      sort_by: column,
      sort_order: prev.sort_by === column && prev.sort_order === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  };

  const handleShortlist = async (tenderId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.patch(`/tenders/${tenderId}`, { internal_status: 'interested' });
      setTenders((prev) =>
        prev.map((t) => (t.id === tenderId ? { ...t, internal_status: 'interested' } : t)),
      );
    } catch {
      /* handled by interceptor */
    }
  };

  const clearFilters = () => {
    setSelectedCategory('');
    setFilters({
      search: '',
      status: '',
      source_id: undefined,
      state: '',
      date_from: '',
      date_to: '',
      page: 1,
      page_size: 20,
      sort_by: 'created_at',
      sort_order: 'desc',
    });
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (filters.sort_by !== column) return <ChevronsUpDown className="h-3 w-3 text-ink-muted/60" />;
    return filters.sort_order === 'asc' ? (
      <ChevronUp className="h-3 w-3 text-brass" />
    ) : (
      <ChevronDown className="h-3 w-3 text-brass" />
    );
  };

  const hasActiveFilters = Boolean(
    filters.status || filters.source_id || filters.state ||
    filters.date_from || filters.date_to || selectedCategory
  );

  const COLUMNS = [
    { key: 'title',               label: 'Title',    sortable: true,  width: 'w-[30%]', align: 'left' as const },
    { key: 'organization',        label: 'Client',   sortable: true,  width: 'w-[16%]', align: 'left' as const },
    { key: 'category',            label: 'Scope',    sortable: false, width: 'w-[13%]', align: 'left' as const },
    { key: 'source_name',         label: 'Source',   sortable: false, width: 'w-[10%]', align: 'left' as const },
    { key: 'estimated_value',     label: 'Value',    sortable: true,  width: 'w-[9%]',  align: 'right' as const },
    { key: 'submission_deadline', label: 'Deadline', sortable: true,  width: 'w-[9%]',  align: 'left' as const },
    { key: 'internal_status',     label: 'Status',   sortable: true,  width: 'w-[8%]',  align: 'left' as const },
    { key: '_actions',            label: '',         sortable: false, width: 'w-[5%]',  align: 'right' as const },
  ];

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1360px] space-y-6">
        {/* Index strip */}
        <section className="flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-4 adm-rise">
          <div>
            <p className="eyebrow mb-1">Catch · {total.toLocaleString('en-IN')} records</p>
            <h2 className="font-display text-[26px] font-normal tracking-[-0.02em] text-ink">
              The full index.
            </h2>
          </div>
          <button
            onClick={fetchTenders}
            className="adm-btn adm-btn-ghost"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </section>

        {/* Search + filter toggle */}
        <section className="flex flex-col gap-3 adm-rise-1 sm:flex-row sm:items-end">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              placeholder="Search by title, reference, organisation…"
              value={filters.search || ''}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="block w-full border-0 border-b border-rule-strong bg-transparent py-2.5 pl-6 pr-8 text-[14px] text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none focus:ring-0"
            />
            {filters.search && (
              <button
                onClick={() => updateFilter('search', '')}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`adm-btn ${showFilters ? '' : 'adm-btn-ghost'} relative`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && !showFilters && (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-brass" />
            )}
          </button>
        </section>

        {/* Category chips */}
        <section className="flex flex-wrap gap-2 adm-rise-2">
          {CATEGORY_OPTIONS.map((cat) => {
            const value = cat === 'All' ? '' : cat;
            const isActive = selectedCategory === value;
            return (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(value);
                  setFilters((prev) => ({ ...prev, page: 1 }));
                }}
                className={`font-mono text-[11px] uppercase tracking-[0.08em] transition-colors border px-2.5 py-1 ${
                  isActive
                    ? 'bg-ink text-paper border-ink'
                    : 'bg-transparent text-ink-soft border-rule-strong hover:text-ink hover:border-ink'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </section>

        {/* Expanded filters */}
        {showFilters && (
          <section className="doc p-5 adm-rise-3">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
              <FieldSelect
                label="Status"
                value={filters.status || ''}
                onChange={(v) => updateFilter('status', v)}
                options={STATUS_OPTIONS}
              />
              <FieldSelect
                label="Source"
                value={String(filters.source_id || '')}
                onChange={(v) => updateFilter('source_id', v ? Number(v) : undefined)}
                options={[{ value: '', label: 'All sources' }, ...sources.map((s) => ({ value: String(s.id), label: s.name }))]}
              />
              <FieldText
                label="Location"
                placeholder="State or city…"
                value={filters.state || ''}
                onChange={(v) => updateFilter('state', v)}
              />
              <FieldText
                label="From date"
                type="date"
                value={filters.date_from || ''}
                onChange={(v) => updateFilter('date_from', v)}
              />
              <FieldText
                label="To date"
                type="date"
                value={filters.date_to || ''}
                onChange={(v) => updateFilter('date_to', v)}
              />
            </div>
            {hasActiveFilters && (
              <div className="mt-5 flex justify-end border-t border-rule pt-4">
                <button
                  onClick={clearFilters}
                  className="adm-btn adm-btn-ghost"
                >
                  <X className="h-4 w-4" />
                  Clear filters
                </button>
              </div>
            )}
          </section>
        )}

        {/* Table */}
        <section className="doc overflow-hidden adm-rise-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-ink-muted" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertTriangle className="mb-3 h-8 w-8 text-signal" />
              <p className="eyebrow text-signal">Signal lost</p>
              <p className="mt-1 text-[13px] text-ink-soft">{error}</p>
              <button onClick={fetchTenders} className="adm-btn adm-btn-ghost mt-4">
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          ) : tenders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="eyebrow mb-2">Empty index</p>
              <p className="font-display text-[22px] font-normal text-ink">
                No tenders match this view.
              </p>
              <p className="mt-2 text-[13px] text-ink-soft">
                Adjust your filters, or clear the search.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed border-collapse">
                  <thead>
                    <tr className="border-b border-rule bg-paper-tint/60">
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          onClick={col.sortable ? () => handleSort(col.key) : undefined}
                          className={`${col.width} ${col.align === 'right' ? 'text-right' : 'text-left'} px-5 py-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted ${
                            col.sortable ? 'cursor-pointer hover:text-ink' : ''
                          }`}
                        >
                          <span className={`inline-flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end w-full' : ''}`}>
                            {col.label}
                            {col.sortable && <SortIcon column={col.key} />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tenders.map((tender) => {
                      const cd = formatCountdown(tender.submission_deadline);
                      const tone =
                        cd.tone === 'overdue' || cd.tone === 'urgent' ? 'text-signal' :
                        cd.tone === 'warn' ? 'text-amber' :
                        'text-ink-soft';
                      const cats: string[] = ((tender as any).categories || [(tender as any).category]).filter(Boolean);
                      return (
                        <tr
                          key={tender.id}
                          className="group border-b border-rule-soft transition-colors last:border-b-0 hover:bg-canvas-tint cursor-pointer"
                          onClick={() => router.push(`/tenders/${tender.id}`)}
                        >
                          <td className="px-5 py-4 align-top">
                            <Link
                              href={`/tenders/${tender.id}`}
                              className="block"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <p className="line-clamp-2 text-[13.5px] font-medium leading-snug text-ink group-hover:text-navy">
                                {tender.title}
                              </p>
                              <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">
                                {tender.reference_number || 'NO-REF'}
                              </p>
                            </Link>
                          </td>
                          <td className="px-5 py-4 align-top text-[13px] text-ink-soft">
                            <p className="truncate">{tender.organization || '—'}</p>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="flex flex-wrap gap-1">
                              {cats.slice(0, 2).map((cat, idx) => (
                                <span
                                  key={idx}
                                  className="pill text-ink-soft border-ink-soft"
                                >
                                  {cat}
                                </span>
                              ))}
                              {cats.length === 0 && <span className="text-ink-muted">—</span>}
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted">
                            {tender.source_name || '—'}
                          </td>
                          <td className="px-5 py-4 text-right align-top font-mono text-[12.5px] font-medium text-ink tabular-nums">
                            {tender.estimated_value ? formatCurrencyShort(tender.estimated_value) : '—'}
                          </td>
                          <td className={`px-5 py-4 align-top text-[12.5px] tabular-nums ${tone}`}>
                            {cd.text}
                          </td>
                          <td className="px-5 py-4 align-top">
                            <span className={`pill ${getStatusColor(tender.internal_status || tender.status)}`}>
                              {getStatusLabel(tender.internal_status || tender.status)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right align-top">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => handleShortlist(tender.id, e)}
                                title={tender.internal_status === 'interested' ? 'Shortlisted' : 'Shortlist'}
                                className={`p-1.5 transition-colors ${
                                  tender.internal_status === 'interested'
                                    ? 'text-brass'
                                    : 'text-ink-muted hover:text-brass'
                                }`}
                              >
                                <Star
                                  className="h-4 w-4"
                                  fill={tender.internal_status === 'interested' ? 'currentColor' : 'none'}
                                />
                              </button>
                              <Link
                                href={`/tenders/${tender.id}`}
                                onClick={(e) => e.stopPropagation()}
                                title="Open"
                                className="p-1.5 text-ink-muted transition-colors hover:text-ink"
                              >
                                <ArrowUpRight className="h-4 w-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-6 py-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                  Showing {(filters.page! - 1) * filters.page_size! + 1}
                  &nbsp;–&nbsp;
                  {Math.min(filters.page! * filters.page_size!, total)}
                  &nbsp;of&nbsp;
                  {total.toLocaleString('en-IN')}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    disabled={filters.page === 1}
                    onClick={() => updateFilter('page', (filters.page || 1) - 1)}
                    className="adm-btn adm-btn-ghost disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="font-mono text-[11.5px] tabular-nums text-ink-soft">
                    {filters.page} / {totalPages || 1}
                  </span>
                  <button
                    disabled={filters.page === totalPages || totalPages === 0}
                    onClick={() => updateFilter('page', (filters.page || 1) + 1)}
                    className="adm-btn adm-btn-ghost disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

/* ──────────────────────────────────────────────────────────────
   Light-weight field atoms used in the filter row
   ────────────────────────────────────────────────────────────── */

function FieldSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="eyebrow mb-2 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full appearance-none border-0 border-b border-rule-strong bg-transparent py-2 pr-6 text-[13.5px] text-ink focus:border-ink focus:outline-none focus:ring-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FieldText({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="eyebrow mb-2 block">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full border-0 border-b border-rule-strong bg-transparent py-2 text-[13.5px] text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none focus:ring-0"
      />
    </div>
  );
}

export default function TendersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-ink-muted" />
        </div>
      }
    >
      <TendersPageContent />
    </Suspense>
  );
}
