import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  FolderOpen,
  FileText,
  Clock,
  Star,
  ListChecks,
  CalendarX,
  CalendarDays,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Rocket,
  List,
  ArrowRight,
  TrendingUp,
  Eye,
  KeyRound,
  Landmark,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils';

function FeatureCard({ eyebrow, title, gradient, icon: Icon }) {
  return (
    <div
      className={clsx(
        'relative flex h-44 flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br p-6 text-white shadow-md',
        gradient,
      )}
    >
      <Icon className="absolute right-5 top-5 h-7 w-7 text-white/20" strokeWidth={1.5} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
        {eyebrow}
      </p>
      <h3 className="mt-1 text-xl font-bold tracking-tight">{title}</h3>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, iconClass, badge, subtitle, subtitleClass }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className={clsx('flex h-11 w-11 items-center justify-center rounded-xl', iconClass)}>
          <Icon className="h-5 w-5" />
        </div>
        {badge}
      </div>
      <p className="mt-5 text-sm font-medium text-gray-600">{title}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {subtitle && (
        <p className={clsx('mt-1 text-xs', subtitleClass ?? 'text-gray-500')}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentTenders, setRecentTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scrapingGem, setScrapingGem] = useState(false);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, tendersRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/tenders', { params: { page: 1, page_size: 10, sort_by: 'created_at', sort_order: 'desc' } }),
      ]);
      setStats(statsRes.data);
      setRecentTenders(tendersRes.data.items || tendersRes.data);
    } catch (err) {
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
      // error handled silently, toast would show via interceptor
    } finally {
      setScraping(false);
    }
  };

  // Fetch only the newest GeM bids (since the last run) — usually done in under a minute
  const handleGemNow = async () => {
    try {
      setScrapingGem(true);
      const res = await api.post('/sources/scrape-type/gem');
      toast.success(res.data?.message || 'Fetching the latest GeM tenders');
      // Give the background scrape a head start, then refresh the numbers
      setTimeout(() => fetchDashboard(), 30000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start the GeM scrape';
      // "Already running" isn't a failure — show it as a neutral notice
      if (/already being scraped/i.test(message)) toast(message, { icon: '⏳' });
      else toast.error(message);
    } finally {
      setScrapingGem(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <p className="text-lg font-medium text-gray-900">Failed to load dashboard</p>
          <p className="text-sm text-gray-500">{error}</p>
          <Button onClick={fetchDashboard} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const deadlineRows = (stats?.upcoming_deadlines || []).slice(0, 5).map((t) => {
    const deadlineDate = new Date(t.submission_deadline);
    const days = Math.max(
      0,
      Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    );
    const risk =
      days <= 1 ? 'high' : days <= 7 ? 'medium' : 'low';
    const barGradient =
      risk === 'high'
        ? 'bg-gradient-to-r from-rose-500 to-red-500'
        : risk === 'medium'
          ? 'bg-gradient-to-r from-amber-400 to-orange-500'
          : 'bg-gradient-to-r from-sky-400 to-blue-500';
    const pillCls =
      risk === 'high'
        ? 'bg-red-50 text-red-700 ring-red-600/20'
        : risk === 'medium'
          ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
          : 'bg-blue-50 text-blue-700 ring-blue-600/20';
    const iconBgCls =
      risk === 'high'
        ? 'bg-red-50 text-red-600'
        : risk === 'medium'
          ? 'bg-amber-50 text-amber-600'
          : 'bg-blue-50 text-blue-600';
    const fillPct = Math.max(8, Math.min(100, ((14 - days) / 14) * 100));
    const dateStr = !isNaN(deadlineDate.getTime())
      ? deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
    return {
      id: t.id,
      title: t.title,
      shortTitle: t.title.length > 38 ? t.title.substring(0, 38) + '…' : t.title,
      org: t.organization || t.source_name || '',
      dateStr,
      days,
      risk,
      barGradient,
      pillCls,
      iconBgCls,
      fillPct,
    };
  });

  const riskCounts = (stats?.upcoming_deadlines || []).reduce(
    (acc, t) => {
      const days = Math.ceil(
        (new Date(t.submission_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      if (days <= 3) acc.high += 1;
      else if (days <= 7) acc.medium += 1;
      else acc.onTrack += 1;
      return acc;
    },
    { high: 0, medium: 0, onTrack: 0 },
  );

  const monthlyTrend = stats?.monthly_trend ?? [];
  const monthlyAvg = monthlyTrend.length
    ? Math.round(monthlyTrend.reduce((s, m) => s + m.count, 0) / monthlyTrend.length)
    : 0;
  const monthlyTotal = monthlyTrend.reduce((s, m) => s + m.count, 0);
  const growthVsLY = (() => {
    if (monthlyTrend.length < 2) return null;
    const last = monthlyTrend[monthlyTrend.length - 1].count;
    const first = monthlyTrend[0].count;
    if (!first) return null;
    return Math.round(((last - first) / first) * 100 * 10) / 10;
  })();
  // Month-over-month delta (last vs previous month) for the hero KPI
  const lastMonth = monthlyTrend[monthlyTrend.length - 1]?.count ?? 0;
  const prevMonth = monthlyTrend[monthlyTrend.length - 2]?.count ?? 0;
  const momDelta = prevMonth ? Math.round(((lastMonth - prevMonth) / prevMonth) * 100) : null;
  // Peak month — highest count
  const peakMonth = monthlyTrend.length
    ? monthlyTrend.reduce((m, x) => (x.count > m.count ? x : m), monthlyTrend[0])
    : null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your tender management pipeline
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button onClick={fetchDashboard} variant="outline" size="md" title="Reload the numbers on this page (does not fetch new tenders)">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={handleGemNow}
            loading={scrapingGem}
            variant="outline"
            size="md"
            className="border-gold-500/60 text-brand-800 hover:border-gold-500 hover:bg-gold-100/60"
            title="Fetch the newest tenders from GeM (Government e-Marketplace) only"
          >
            <Landmark className="h-4 w-4 text-gold-600" />
            GeM Now
          </Button>
          <Button
            onClick={handleScrapeNow}
            loading={scraping}
            variant="primary"
            size="md"
            title="Fetch new tenders from all sources: GeM, eTenders, CPPP and IREPS"
          >
            <Rocket className="h-4 w-4" />
            Scrape Now
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Tenders"
          value={stats?.total_tenders ?? 0}
          icon={FolderOpen}
          iconClass="bg-blue-50 text-blue-600"
          badge={
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
              Today: {stats?.new_today ?? 0}
            </span>
          }
        />
        <StatCard
          title="Shortlisted"
          value={stats?.tenders_by_status?.['interested'] ?? stats?.active_tenders ?? 0}
          icon={Star}
          iconClass="bg-orange-50 text-orange-500"
        />
        <StatCard
          title="Pending Review"
          value={stats?.tenders_by_status?.['new'] ?? stats?.tenders_by_status?.['scraped'] ?? 0}
          icon={ListChecks}
          iconClass="bg-gray-100 text-gray-600"
        />
        <StatCard
          title="Upcoming Deadlines"
          value={stats?.closing_soon ?? 0}
          icon={CalendarX}
          iconClass="bg-red-50 text-red-500"
          badge={
            <span className="text-[11px] font-semibold uppercase tracking-wider text-red-500">
              Urgent
            </span>
          }
          subtitle="Closing within 7 days"
          subtitleClass="text-red-500 font-medium"
        />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => navigate('/tenders?status=interested')}
          variant="outline"
          size="md"
        >
          <Eye className="h-4 w-4" />
          View Shortlisted
        </Button>
        <Button
          onClick={() => navigate('/admin/keywords')}
          variant="outline"
          size="md"
        >
          <KeyRound className="h-4 w-4" />
          Manage Keywords
        </Button>
      </div>

      {/* Charts and tables row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Deadlines list */}
        <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Deadlines</h2>
            <Link
              to="/tenders"
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              View All
            </Link>
          </div>

          {deadlineRows.length > 0 ? (
            <ul className="flex-1 space-y-2">
              {deadlineRows.map((row) => (
                <li key={row.id}>
                  <Link
                    to={`/tenders/${row.id}`}
                    className="group block rounded-xl border border-transparent p-2.5 transition-colors hover:border-gray-200 hover:bg-gray-50/70"
                    title={row.title}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={clsx(
                          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-current/10',
                          row.iconBgCls,
                        )}
                      >
                        <CalendarDays className="h-5 w-5" strokeWidth={2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-blue-600">
                            {row.shortTitle}
                          </p>
                          <span
                            className={clsx(
                              'flex-shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                              row.pillCls,
                            )}
                          >
                            {row.days === 0 ? 'Today' : `${row.days}d left`}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          {row.org && <span className="text-gray-600">{row.org}</span>}
                          {row.org && row.dateStr && <span className="px-1 text-gray-300">•</span>}
                          {row.dateStr}
                        </p>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={clsx('h-full rounded-full transition-all', row.barGradient)}
                            style={{ width: `${row.fillPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-[260px] flex-1 items-center justify-center text-sm text-gray-400">
              No upcoming deadlines
            </div>
          )}

          {/* Risk summary footer */}
          <div className="mt-6 grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 pt-5 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{riskCounts.high}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-red-500">
                High Risk
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{riskCounts.medium}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-500">
                Medium Risk
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{riskCounts.onTrack}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-blue-500">
                On Track
              </p>
            </div>
          </div>
        </div>

        {/* Monthly trend */}
        <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-1 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Monthly Trend</h2>
              <p className="mt-0.5 text-xs text-gray-500">Tenders received per month (last 6)</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              Volume
            </span>
          </div>

          {/* Hero KPI */}
          <div className="mt-4 flex items-baseline gap-3">
            <p className="text-3xl font-bold tracking-tight text-gray-900">
              {lastMonth.toLocaleString()}
            </p>
            <span className="text-sm text-gray-500">this month</span>
            {momDelta !== null && (
              <span
                className={clsx(
                  'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                  momDelta >= 0
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                    : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
                )}
              >
                {momDelta >= 0 ? '▲' : '▼'} {Math.abs(momDelta)}%
              </span>
            )}
          </div>

          {monthlyTrend.length > 0 ? (
            <div className="mt-4 flex-1">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyTrend} margin={{ left: 0, right: 0, top: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2d4a7c" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#4a6593" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#efede9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#7b776e' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid #e6e4df',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      fontSize: '12px',
                    }}
                    cursor={{ fill: '#f3f2ef' }}
                    formatter={(value) => [`${value} tenders`, 'Count']}
                  />
                  <Bar
                    dataKey="count"
                    fill="url(#trendGradient)"
                    radius={[8, 8, 0, 0]}
                    barSize={28}
                    name="Tenders"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[200px] flex-1 items-center justify-center text-sm text-gray-400">
              No trend data available
            </div>
          )}

          {/* Trend stats footer — 3-column summary */}
          <div className="mt-5 grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 pt-5 text-center">
            <div>
              <p className="text-xl font-bold text-gray-900">{monthlyTotal.toLocaleString()}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Total
              </p>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{monthlyAvg.toLocaleString()}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Avg / Mo
              </p>
            </div>
            <div>
              <p
                className={clsx(
                  'text-xl font-bold',
                  growthVsLY === null
                    ? 'text-gray-400'
                    : growthVsLY >= 0
                      ? 'text-emerald-600'
                      : 'text-red-500',
                )}
              >
                {growthVsLY === null
                  ? '—'
                  : `${growthVsLY >= 0 ? '+' : ''}${growthVsLY}%`}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Growth
              </p>
            </div>
          </div>

          {peakMonth && (
            <p className="mt-3 text-[11px] text-gray-400">
              Peak month:{' '}
              <span className="font-semibold text-gray-600">{peakMonth.month}</span> ·{' '}
              {peakMonth.count.toLocaleString()} tenders
            </p>
          )}
        </div>
      </div>

      {/* Feature cards (Insight / Workflow / Strategy) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FeatureCard
          eyebrow="Insight Engine"
          title="Advanced Analytics"
          gradient="from-slate-900 via-slate-800 to-blue-900"
          icon={TrendingUp}
        />
        <FeatureCard
          eyebrow="Workflow"
          title="Seamless Teamwork"
          gradient="from-slate-900 via-indigo-950 to-slate-800"
          icon={ListChecks}
        />
        <FeatureCard
          eyebrow="Strategy"
          title="Procurement Intelligence"
          gradient="from-slate-900 via-slate-800 to-emerald-900"
          icon={Rocket}
        />
      </div>

      {/* Recent tenders — card-style list */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-gray-900 sm:text-lg">Recent Tenders</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {recentTenders.length > 0
                ? `Latest ${recentTenders.length} entries from your live sources`
                : 'No tenders yet'}
            </p>
          </div>
          <Link
            to="/tenders"
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {recentTenders.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-400">
            <List className="mx-auto mb-2 h-8 w-8" />
            No tenders found. Click "Scrape Now" to refresh the live cache.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentTenders.map((tender) => {
              const status = tender.internal_status || tender.status;
              const statusCls = getStatusColor(status);
              const dline = tender.submission_deadline
                ? new Date(tender.submission_deadline)
                : null;
              const daysLeft =
                dline && !isNaN(dline.getTime())
                  ? Math.max(
                      0,
                      Math.ceil((dline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
                    )
                  : null;
              const urgent = daysLeft !== null && daysLeft <= 7;
              const value = tender.estimated_value
                ? formatCurrency(
                    tender.estimated_value,
                    tender.currency || tender.estimated_cost_currency || 'INR',
                  )
                : null;
              return (
                <li key={tender.id} className="group">
                  <Link
                    to={`/tenders/${tender.id}`}
                    className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-gray-50/70 sm:px-6"
                  >
                    {/* Icon avatar */}
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-600/10">
                      <FileText className="h-5 w-5" strokeWidth={2} />
                    </div>

                    {/* Body */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-1 text-sm font-semibold text-gray-900 group-hover:text-blue-600">
                          {tender.title}
                        </p>
                        <span
                          className={`flex-shrink-0 inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusCls}`}
                        >
                          {getStatusLabel(status).toUpperCase()}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        {tender.organization && (
                          <span className="truncate text-gray-600">{tender.organization}</span>
                        )}
                        {tender.source_name && (
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                            {tender.source_name}
                          </span>
                        )}
                        {tender.reference_number && (
                          <span className="truncate font-mono text-[11px] text-gray-400">
                            {tender.reference_number}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        {value && (
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-gray-900">
                            {value}
                          </span>
                        )}
                        {dline && (
                          <span
                            className={`inline-flex items-center gap-1 ${
                              urgent ? 'font-semibold text-red-600' : 'text-gray-500'
                            }`}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            {daysLeft !== null && daysLeft <= 30
                              ? daysLeft === 0
                                ? 'Closes today'
                                : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
                              : `Due ${formatDate(tender.submission_deadline)}`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Chevron */}
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-300 group-hover:text-blue-500" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
