import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  FolderOpen,
  Landmark,
  ListChecks,
  Loader2,
  RefreshCw,
  Rocket,
  Star,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { formatCurrency, formatDate, getStatusLabel } from '@/lib/utils';

/* Classic & simple: white cards, navy text, grey details. No status colours —
   urgency is shown with words ("Today", "2 days left") and weight, not red. */

const RECENT_LIMIT = 5;
const DEADLINE_LIMIT = 5;

const daysUntil = (d) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  // Count calendar days, so a deadline later today reads "Today", not "1 day left"
  const today = new Date();
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.max(0, Math.round((b - a) / 86400000));
};

const daysLabel = (days) => (days === 0 ? 'Today' : days === 1 ? '1 day left' : `${days} days left`);

function StatCard({ label, value, note, icon: Icon, to }) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <Icon className="h-4 w-4 text-gray-400" />
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
    </>
  );
  const cls = 'block rounded-xl border border-gray-200 bg-white p-5 transition-colors';
  return to ? (
    <Link to={to} className={clsx(cls, 'hover:border-gray-300 hover:bg-gray-50/60')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Panel({ title, subtitle, action, children }) {
  return (
    <section className="flex flex-col rounded-xl border border-gray-200 bg-white">
      <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

const ViewAll = ({ to }) => (
  <Link to={to} className="inline-flex flex-shrink-0 items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
    View all <ArrowRight className="h-4 w-4" />
  </Link>
);

export default function DashboardPage() {
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
        api.get('/tenders', {
          params: { page: 1, page_size: RECENT_LIMIT, sort_by: 'created_at', sort_order: 'desc' },
        }),
      ]);
      setStats(statsRes.data);
      setRecentTenders((tendersRes.data.items || tendersRes.data || []).slice(0, RECENT_LIMIT));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
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
      toast.success('Fetching new tenders from all sources');
      await fetchDashboard();
    } catch {
      // the API helper already reports errors
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
      setTimeout(() => fetchDashboard(), 30000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start the GeM scrape';
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
          <Loader2 className="h-7 w-7 animate-spin text-brand-700" />
          <p className="text-sm text-gray-500">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="h-9 w-9 text-gray-400" />
          <p className="text-lg font-medium text-gray-900">Couldn't load the dashboard</p>
          <p className="text-sm text-gray-500">{error}</p>
          <Button onClick={fetchDashboard} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const deadlines = (stats?.upcoming_deadlines || []).slice(0, DEADLINE_LIMIT).map((t) => ({
    ...t,
    days: daysUntil(t.submission_deadline),
  }));
  const monthlyTrend = stats?.monthly_trend ?? [];
  const thisMonth = monthlyTrend[monthlyTrend.length - 1]?.count ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Overview of your tender pipeline</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={fetchDashboard} variant="outline" size="md" title="Reload the numbers on this page (does not fetch new tenders)">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={handleGemNow}
            loading={scrapingGem}
            variant="outline"
            size="md"
            title="Fetch the newest tenders from GeM (Government e-Marketplace) only"
          >
            <Landmark className="h-4 w-4" />
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

      {/* Key numbers */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total tenders"
          value={stats?.total_tenders ?? 0}
          note={`${(stats?.new_today ?? 0).toLocaleString()} added today`}
          icon={FolderOpen}
          to="/tenders"
        />
        <StatCard
          label="Shortlisted"
          value={stats?.tenders_by_status?.['interested'] ?? stats?.active_tenders ?? 0}
          note="Marked for follow-up"
          icon={Star}
          to="/tenders?status=interested"
        />
        <StatCard
          label="Pending review"
          value={stats?.tenders_by_status?.['new'] ?? stats?.tenders_by_status?.['scraped'] ?? 0}
          note="Not yet reviewed"
          icon={ListChecks}
          to="/tenders?status=new"
        />
        <StatCard
          label="Closing soon"
          value={stats?.closing_soon ?? 0}
          note="Within the next 7 days"
          icon={CalendarClock}
          to="/tenders?sort_by=submission_deadline&sort_order=asc"
        />
      </div>

      {/* Deadlines + trend */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel
          title="Upcoming deadlines"
          subtitle="The next tenders to close"
          action={<ViewAll to="/tenders?sort_by=submission_deadline&sort_order=asc" />}
        >
          {deadlines.length ? (
            <ul className="divide-y divide-gray-100">
              {deadlines.map((t) => (
                <li key={t.id}>
                  <Link to={`/tenders/${t.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-gray-50" title={t.title}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{t.title}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {[t.organization || t.source_name, formatDate(t.submission_deadline, 'd MMM yyyy')].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className={clsx('flex-shrink-0 text-xs', t.days !== null && t.days <= 1 ? 'font-semibold text-gray-900' : 'text-gray-500')}>
                      {t.days === null ? '—' : daysLabel(t.days)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-12 text-center text-sm text-gray-500">No upcoming deadlines</p>
          )}
        </Panel>

        <Panel title="Tenders per month" subtitle="Added in the last 6 months">
          <div className="px-5 pb-4 pt-4">
            <p className="text-2xl font-semibold text-gray-900">
              {thisMonth.toLocaleString()} <span className="text-sm font-normal text-gray-500">this month</span>
            </p>
            {monthlyTrend.length ? (
              <div className="mt-3">
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={monthlyTrend} margin={{ left: 0, right: 0, top: 5, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#efede9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#7b776e' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: '#f3f2ef' }}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e6e4df', fontSize: 12 }}
                      formatter={(value) => [`${Number(value).toLocaleString()} tenders`, 'Added']}
                    />
                    <Bar dataKey="count" fill="#2d4a7c" radius={[4, 4, 0, 0]} barSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-gray-500">No data yet</p>
            )}
          </div>
        </Panel>
      </div>

      {/* Recent tenders (latest 5) */}
      <Panel title="Recent tenders" subtitle={`Latest ${RECENT_LIMIT} added`} action={<ViewAll to="/tenders" />}>
        {recentTenders.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-gray-500">No tenders yet. Click "Scrape Now" to fetch them.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentTenders.map((tender) => {
              const status = tender.internal_status || tender.status;
              const days = tender.submission_deadline ? daysUntil(tender.submission_deadline) : null;
              const value = tender.estimated_value
                ? formatCurrency(tender.estimated_value, tender.currency || tender.estimated_cost_currency || 'INR')
                : null;
              return (
                <li key={tender.id}>
                  <Link to={`/tenders/${tender.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{tender.title}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {[tender.organization, tender.source_name, tender.reference_number].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="hidden flex-shrink-0 text-right sm:block">
                      {value && <p className="text-sm font-medium text-gray-900">{value}</p>}
                      <p className="text-xs text-gray-500">
                        {days === null ? '' : days <= 30 ? daysLabel(days) : `Closes ${formatDate(tender.submission_deadline, 'd MMM')}`}
                      </p>
                    </div>
                    <span className="hidden flex-shrink-0 rounded border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600 md:inline">
                      {getStatusLabel(status)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
