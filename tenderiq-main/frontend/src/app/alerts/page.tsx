'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  Loader2,
  AlertTriangle,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  AlertCircle,
  Info,
} from 'lucide-react';
import AppLayout from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Alert, PaginatedResponse } from '@/lib/types';

const ALERT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'new_tender', label: 'New Tender' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'status_change', label: 'Status Change' },
  { value: 'keyword_match', label: 'Keyword Match' },
  { value: 'system', label: 'System' },
];

const READ_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'false', label: 'Unread' },
  { value: 'true', label: 'Read' },
];

function getAlertTypeIcon(type: string) {
  switch (type) {
    case 'new_tender': return <FileText className="h-4 w-4 text-navy" />;
    case 'deadline': return <Clock className="h-4 w-4 text-signal" />;
    case 'status_change': return <AlertCircle className="h-4 w-4 text-brass" />;
    case 'keyword_match': return <Bell className="h-4 w-4 text-moss" />;
    default: return <Info className="h-4 w-4 text-ink-muted" />;
  }
}

function getAlertTypeBadge(type: string) {
  switch (type) {
    case 'new_tender': return 'info' as const;
    case 'deadline': return 'warning' as const;
    case 'status_change': return 'default' as const;
    case 'keyword_match': return 'success' as const;
    default: return 'default' as const;
  }
}

export default function AlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [readFilter, setReadFilter] = useState('');
  const [page, setPage] = useState(1);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const pageSize = 20;

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number | boolean> = { page, page_size: pageSize };
      if (typeFilter) params.alert_type = typeFilter;
      if (readFilter !== '') params.is_read = readFilter === 'true';

      const res = await api.get<PaginatedResponse<Alert>>('/alerts', { params });
      setAlerts(res.data.items || []);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load alerts';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, readFilter, page]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleMarkRead = async (alertId: number) => {
    try {
      await api.patch(`/alerts/${alertId}/read`);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a)));
    } catch {
      // handled by interceptor
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAllRead(true);
      await api.post('/alerts/mark-all-read');
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    } catch {
      // handled by interceptor
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleDelete = async (alertId: number) => {
    try {
      await api.delete(`/alerts/${alertId}`);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      setTotal((prev) => prev - 1);
    } catch {
      // handled by interceptor
    }
  };

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4 adm-rise">
          <div>
            <p className="eyebrow mb-1">
              Watch &middot; {total.toLocaleString('en-IN')} entries
              {unreadCount > 0 && (
                <span className="text-brass"> &middot; {unreadCount} unread</span>
              )}
            </p>
            <h2 className="font-display text-[26px] font-normal tracking-[-0.02em] text-ink">
              The deadline watch.
            </h2>
          </div>
          <Button
            onClick={handleMarkAllRead}
            variant="secondary"
            loading={markingAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="block appearance-none border-0 border-b border-rule-strong bg-transparent py-2 pr-6 text-[13.5px] text-ink focus:border-ink focus:outline-none focus:ring-0"
          >
            {ALERT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={readFilter}
            onChange={(e) => { setReadFilter(e.target.value); setPage(1); }}
            className="block appearance-none border-0 border-b border-rule-strong bg-transparent py-2 pr-6 text-[13.5px] text-ink focus:border-ink focus:outline-none focus:ring-0"
          >
            {READ_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {(typeFilter || readFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setTypeFilter(''); setReadFilter(''); setPage(1); }}>
              <X className="h-4 w-4" />
              Clear filters
            </Button>
          )}
        </div>

        {/* Alert list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-ink-muted" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertTriangle className="mb-3 h-8 w-8 text-signal" />
            <p className="eyebrow text-signal">Signal lost</p>
            <p className="mt-1 text-[13px] text-ink-soft">{error}</p>
            <Button onClick={fetchAlerts} variant="secondary" size="sm" className="mt-4">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BellOff className="mb-3 h-8 w-8 text-ink-muted/60" />
            <p className="font-display text-[22px] font-normal text-ink">
              All quiet on the watch.
            </p>
            <p className="mt-2 text-[13px] text-ink-soft">You&apos;re all caught up.</p>
          </div>
        ) : (
          <div>
            <ul className="divide-y divide-rule-soft border-y border-rule">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className={`relative px-5 py-4 transition-colors hover:bg-canvas-tint ${
                    alert.is_read ? '' : 'bg-canvas-tint/50'
                  }`}
                >
                  {!alert.is_read && (
                    <span className="absolute left-0 top-5 h-6 w-[2px] bg-brass" aria-hidden />
                  )}
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center border border-rule bg-canvas">
                      {getAlertTypeIcon(alert.alert_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={`text-[14px] leading-snug ${alert.is_read ? 'text-ink-soft' : 'font-medium text-ink'}`}>
                          {alert.title}
                        </h3>
                        <Badge variant={getAlertTypeBadge(alert.alert_type)}>
                          {alert.alert_type.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{alert.message}</p>
                      <div className="mt-2 flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">
                        <span>{formatDate(alert.created_at, 'dd MMM yyyy &middot; HH:mm')}</span>
                        {alert.tender_title && (
                          <>
                            <span>&middot;</span>
                            <button
                              onClick={() => alert.tender_id && router.push(`/tenders/${alert.tender_id}`)}
                              className="normal-case text-ink hover:text-navy"
                            >
                              {alert.tender_title}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      {!alert.is_read && (
                        <button
                          onClick={() => handleMarkRead(alert.id)}
                          title="Mark as read"
                          className="p-1.5 text-ink-muted transition-colors hover:text-ink"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(alert.id)}
                        title="Delete"
                        className="p-1.5 text-ink-muted transition-colors hover:text-signal"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                Showing {(page - 1) * pageSize + 1}
                &nbsp;&ndash;&nbsp;
                {Math.min(page * pageSize, total)}
                &nbsp;of&nbsp;
                {total.toLocaleString('en-IN')}
              </p>
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="font-mono text-[11.5px] tabular-nums text-ink-soft">
                  {page} / {totalPages || 1}
                </span>
                <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
