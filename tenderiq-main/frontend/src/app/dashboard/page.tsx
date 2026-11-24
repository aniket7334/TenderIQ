'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  RefreshCw,
  ArrowUpRight,
  AlertTriangle,
  Anchor,
} from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';
import api from '@/lib/api';
import {
  formatCurrencyShort,
  formatCountdown,
  getStatusColor,
  getStatusLabel,
} from '@/lib/utils';
import type { DashboardStats, Tender } from '@/lib/types';

/* ──────────────────────────────────────────────────────────────
   Reading — a single stat card in the admiralty aesthetic.
   Mono tabular number, eyebrow label, hairline rule.
   ────────────────────────────────────────────────────────────── */
interface ReadingProps {
  code: string;      // "01", "02" — journal reference
  label: string;
  value: string | number;
  caption?: string;
  delta?: { value: string; tone: 'ok' | 'warn' | 'urgent' };
  accent?: boolean;  // highlight (brass left rail)
  risen?: string;    // adm-rise animation class e.g. "adm-rise-1"
}

function Reading({ code, label, value, caption, delta, accent, risen }: ReadingProps) {
  const toneClass =
    delta?.tone === 'urgent' ? 'text-signal' :
    delta?.tone === 'warn' ? 'text-amber' :
    'text-moss';

  return (
    <div
      className={`doc relative px-5 py-5 ${risen ?? ''}`}
    >
      {accent && (
        <span className="absolute left-0 top-5 h-6 w-[2px] bg-brass" aria-hidden />
      )}
      <div className="flex items-start justify-between">
        <span className="eyebrow">{code} &middot; {label}</span>
      </div>
      <p className="mt-5 font-mono text-[36px] font-medium leading-none tracking-tight text-ink tabular-nums">
        {value}
      </p>
      <div className="mt-3 flex items-end justify-between gap-3">
        {caption ? (
          <p className="text-[12.5px] leading-tight text-ink-muted">{caption}</p>
        ) : <span />}
        {delta && (
          <span className={`font-mono text-[11px] font-medium ${toneClass}`}>
            {delta.value}
          </span>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Dashboard
   ────────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTenders, setRecentTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, tendersRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/tenders', { params: { page: 1, page_size: 8, sort_by: 'created_at', sort_order: 'desc' } }),
      ]);
      setStats(statsRes.data);
      // Dedupe by id — the live cache aggregates many sources and can
      // occasionally return the same tender twice, which React treats as
      // a duplicate-key error.
      const rawTenders: Tender[] = tendersRes.data.items || tendersRes.data || [];
      const dedupedTenders = Array.from(
        new Map(rawTenders.map((t) => [t.id, t])).values(),
      );
      setRecentTenders(dedupedTenders);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleScrapeNow = async () => {
    try {
      setScraping(true);
      await api.post('/sources/scrape-all');
      await fetchDashboard();
    } catch {
      /* interceptor handles toast */
    } finally {
      setScraping(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <Loader2 className="h-6 w-6 animate-spin text-ink-muted" />
          <p className="eyebrow">Reading the desk</p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="h-8 w-8 text-signal" />
          <p className="eyebrow text-signal">Signal lost</p>
          <p className="max-w-md text-[13.5px] text-ink-soft">{error}</p>
          <button
            onClick={fetchDashboard}
            className="adm-btn-ghost adm-btn mt-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry reading
          </button>
        </div>
      </AppLayout>
    );
  }

  const upcoming = (stats?.upcoming_deadlines || []).slice(0, 7);
  const monthlyTrend = stats?.monthly_trend ?? [];
  const trendMax = Math.max(1, ...monthlyTrend.map((m) => m.count ?? 0));
  const trendTotal = monthlyTrend.reduce((s, m) => s + (m.count ?? 0), 0);
  const trendLast = monthlyTrend[monthlyTrend.length - 1]?.count ?? 0;
  const trendPrev = monthlyTrend[monthlyTrend.length - 2]?.count ?? 0;
  const trendDelta = trendLast - trendPrev;

  const total = stats?.total_tenders ?? 0;
  const shortlisted = stats?.tenders_by_status?.['interested'] ?? stats?.active_tenders ?? 0;
  const pending = stats?.tenders_by_status?.['new'] ?? stats?.tenders_by_status?.['scraped'] ?? 0;
  const closing = stats?.closing_soon ?? 0;

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).toUpperCase();

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1360px] space-y-10">
        {/* ── Masthead ── */}
        <section className="flex flex-wrap items-end justify-between gap-6 border-b border-rule pb-6 adm-rise">
          <div>
            <p className="eyebrow mb-2">Edition &middot; {today}</p>
            <h2 className="font-display text-[32px] font-normal leading-[1.05] tracking-[-0.02em] text-ink">
              Today on the desk.
            </h2>
            <p className="mt-2 max-w-[520px] text-[14px] text-ink-soft">
              <span className="num">{stats?.new_today ?? 0}</span> new tenders arrived since
              yesterday. <span className="num">{closing}</span> close within the week.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchDashboard}
              className="adm-btn adm-btn-ghost"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={handleScrapeNow}
              disabled={scraping}
              className="adm-btn"
            >
              {scraping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Anchor className="h-4 w-4" />
              )}
              {scraping ? 'Fetching…' : 'Fetch new'}
            </button>
          </div>
        </section>

        {/* ── Readings ── */}
        <section className="grid grid-cols-1 gap-px bg-rule sm:grid-cols-2 lg:grid-cols-4 overflow-hidden border border-rule">
          <Reading
            code="01"
            label="Total tenders"
            value={total.toLocaleString('en-IN')}
            caption={`${stats?.new_today ?? 0} new today`}
            risen="adm-rise-1"
          />
          <Reading
            code="02"
            label="Shortlisted"
            value={shortlisted}
            caption="Awaiting bid decision"
            accent
            risen="adm-rise-2"
          />
          <Reading
            code="03"
            label="Pending review"
            value={pending}
            caption="Fresh, unqualified"
            risen="adm-rise-3"
          />
          <Reading
            code="04"
            label="Closing within 7d"
            value={closing}
            caption="Deadline pressure"
            delta={closing > 0 ? { value: 'ATTEND', tone: closing > 5 ? 'urgent' : 'warn' } : undefined}
            risen="adm-rise-4"
          />
        </section>

        {/* ── Charts ── */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* ─── Deadline board — airport-timetable style ─── */}
          <div className="doc overflow-hidden adm-rise-2 lg:col-span-3">
            <div className="flex items-end justify-between border-b border-rule px-6 py-5">
              <div>
                <p className="eyebrow mb-1">05 &middot; Deadline board</p>
                <h3 className="font-display text-[20px] font-normal leading-none text-ink">
                  Nearest horizons
                </h3>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                  top {upcoming.length}
                </span>
                <button
                  onClick={fetchDashboard}
                  disabled={loading}
                  title="Fetch the latest tenders"
                  className="group inline-flex items-center gap-1.5 border border-ink/80 bg-ink px-3 py-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-paper transition-colors hover:bg-navy-ink disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 transition-transform group-hover:rotate-180" />
                  )}
                  Fetch latest
                </button>
              </div>
            </div>
            {upcoming.length === 0 ? (
              <EmptyPanel label="No upcoming deadlines" padded />
            ) : (
              <ul>
                {upcoming.map((t, idx) => {
                  const cd = formatCountdown(t.submission_deadline);
                  const dateStr = (() => {
                    try {
                      return new Date(t.submission_deadline).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short',
                      }).toUpperCase();
                    } catch { return '—'; }
                  })();
                  const toneClass =
                    cd.tone === 'overdue' || cd.tone === 'urgent'
                      ? 'text-signal border-signal'
                      : cd.tone === 'warn'
                        ? 'text-amber border-amber'
                        : 'text-ink-soft border-ink-soft';
                  return (
                    <li
                      key={t.id ?? idx}
                      className="group grid cursor-pointer grid-cols-[64px_1fr_auto] items-center gap-4 border-b border-rule-soft px-6 py-4 transition-colors last:border-b-0 hover:bg-canvas-tint"
                      onClick={() => router.push(`/tenders/${t.id}`)}
                    >
                      {/* Date gutter */}
                      <div className="flex flex-col leading-tight">
                        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                          {dateStr.split(' ')[1]}
                        </span>
                        <span className="font-display text-[22px] font-normal tracking-[-0.015em] text-ink">
                          {dateStr.split(' ')[0]}
                        </span>
                      </div>
                      {/* Title + organisation */}
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium leading-snug text-ink group-hover:text-navy">
                          {t.title}
                        </p>
                        <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">
                          {t.organization || '—'}
                        </p>
                      </div>
                      {/* Days-left pill */}
                      <span className={`pill shrink-0 ${toneClass}`}>
                        {cd.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ─── Monthly trend ─── */}
          <div className="doc p-6 adm-rise-3 lg:col-span-2">
            <div className="mb-5">
              <p className="eyebrow mb-1">06 &middot; Monthly trend</p>
              <h3 className="font-display text-[20px] font-normal leading-none text-ink">
                Pipeline over time
              </h3>
            </div>

            {/* Summary line */}
            <div className="mb-6 flex items-baseline justify-between border-b border-rule-soft pb-4">
              <div>
                <p className="font-mono text-[32px] font-medium leading-none tracking-tight text-ink tabular-nums">
                  {trendTotal.toLocaleString('en-IN')}
                </p>
                <p className="eyebrow mt-2">Added · last 6 months</p>
              </div>
              {monthlyTrend.length >= 2 && (
                <div className="text-right">
                  <p
                    className={`font-mono text-[14px] font-medium tabular-nums ${trendDelta >= 0 ? 'text-moss' : 'text-signal'}`}
                  >
                    {trendDelta >= 0 ? '+' : ''}
                    {trendDelta}
                  </p>
                  <p className="eyebrow mt-1">vs prior month</p>
                </div>
              )}
            </div>

            {monthlyTrend.length === 0 ? (
              <EmptyPanel label="No trend data yet" />
            ) : (
              <div>
                {/* Hand-drawn bars so we can control proportions and labels precisely */}
                <ul className="flex items-end gap-3 h-[180px] px-1">
                  {monthlyTrend.map((m, i) => {
                    const pct = Math.max(2, Math.round(((m.count ?? 0) / trendMax) * 100));
                    const isLast = i === monthlyTrend.length - 1;
                    return (
                      <li
                        key={`${m.month}-${i}`}
                        className="group relative flex flex-1 flex-col items-center justify-end"
                      >
                        <span
                          className={`block w-full transition-opacity ${
                            isLast ? 'bg-brass' : 'bg-ink/80'
                          } group-hover:opacity-100 opacity-85`}
                          style={{ height: `${pct}%` }}
                          title={`${m.month}: ${m.count}`}
                        />
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-2 flex gap-3 border-t border-rule-soft pt-2 px-1">
                  {monthlyTrend.map((m, i) => {
                    const label = String(m.month).split(' ')[0]?.slice(0, 3) ?? m.month;
                    return (
                      <div key={`lbl-${m.month}-${i}`} className="flex flex-1 flex-col items-center leading-none">
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                          {label}
                        </span>
                        <span className="mt-1 font-mono text-[11px] tabular-nums text-ink-soft">
                          {m.count ?? 0}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Recent tenders ── */}
        <section className="doc overflow-hidden adm-rise-4">
          <div className="flex items-end justify-between border-b border-rule px-6 py-5">
            <div>
              <p className="eyebrow mb-1">07 &middot; Dispatches</p>
              <h3 className="font-display text-[22px] font-normal leading-none text-ink">
                Latest from the wire
              </h3>
            </div>
            <Link
              href="/tenders"
              className="group inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink hover:text-navy"
            >
              Full index
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>

          {recentTenders.length === 0 ? (
            <EmptyPanel
              label='The wire is quiet. Click "Fetch new" to refresh the catch.'
              padded
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse">
                {/* Ref · Title · Org · Value · Deadline · Status · Open */}
                <colgroup>
                  <col className="w-[13%]" /><col className="w-[36%]" /><col className="w-[17%]" /><col className="w-[10%]" /><col className="w-[8%]" /><col className="w-[9%]" /><col className="w-[7%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-rule bg-paper-tint/60">
                    <Th>Ref</Th>
                    <Th>Title</Th>
                    <Th>Organisation</Th>
                    <Th align="right">Value</Th>
                    <Th>Deadline</Th>
                    <Th>Status</Th>
                    <Th align="right">&nbsp;</Th>
                  </tr>
                </thead>
                <tbody>
                  {recentTenders.map((t) => {
                    const cd = formatCountdown(t.submission_deadline);
                    const tone =
                      cd.tone === 'overdue' ? 'text-signal' :
                      cd.tone === 'urgent' ? 'text-signal' :
                      cd.tone === 'warn' ? 'text-amber' :
                      'text-ink-soft';
                    return (
                      <tr
                        key={t.id}
                        className="border-b border-rule-soft transition-colors last:border-b-0 hover:bg-canvas-tint cursor-pointer"
                        onClick={() => router.push(`/tenders/${t.id}`)}
                      >
                        <td className="px-6 py-4 align-top">
                          <span
                            className="block truncate font-mono text-[11.5px] text-ink-soft tabular-nums"
                            title={t.reference_number || ''}
                          >
                            {t.reference_number || '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <Link
                            href={`/tenders/${t.id}`}
                            className="line-clamp-2 text-[13.5px] font-medium leading-snug text-ink hover:text-navy"
                            onClick={(e) => e.stopPropagation()}
                            title={t.title}
                          >
                            {t.title}
                          </Link>
                        </td>
                        <td className="px-6 py-4 align-top text-[13px] text-ink-soft">
                          <span className="block truncate" title={t.organization || ''}>
                            {t.organization || '—'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right align-top">
                          <span className="font-mono text-[12.5px] font-medium text-ink tabular-nums">
                            {t.estimated_value ? formatCurrencyShort(t.estimated_value) : '—'}
                          </span>
                        </td>
                        <td className={`whitespace-nowrap px-6 py-4 align-top text-[12.5px] tabular-nums ${tone}`}>
                          {cd.text}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 align-top">
                          <span className={`pill ${getStatusColor(t.internal_status || t.status)}`}>
                            {getStatusLabel(t.internal_status || t.status)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right align-top">
                          <Link
                            href={`/tenders/${t.id}`}
                            className="inline-flex items-center gap-1 text-[12.5px] text-ink-soft hover:text-navy"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`px-6 py-3 ${align === 'right' ? 'text-right' : 'text-left'} font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-muted`}
    >
      {children}
    </th>
  );
}

function EmptyPanel({ label, padded }: { label: string; padded?: boolean }) {
  return (
    <div className={`flex items-center justify-center text-center text-[13px] text-ink-muted ${padded ? 'py-16' : 'h-[260px]'}`}>
      <p>{label}</p>
    </div>
  );
}
