import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';

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

function getAlertTypeIcon(type) {
  switch (type) {
    case 'new_tender': return <FileText className="h-5 w-5 text-blue-500" />;
    case 'deadline': return <Clock className="h-5 w-5 text-amber-500" />;
    case 'status_change': return <AlertCircle className="h-5 w-5 text-purple-500" />;
    case 'keyword_match': return <Bell className="h-5 w-5 text-green-500" />;
    default: return <Info className="h-5 w-5 text-gray-500" />;
  }
}

function getAlertTypeBadge(type) {
  switch (type) {
    case 'new_tender': return 'info';
    case 'deadline': return 'warning';
    case 'status_change': return 'default';
    case 'keyword_match': return 'success';
    default: return 'default';
  }
}

export default function AlertsPage() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [readFilter, setReadFilter] = useState('');
  const [page, setPage] = useState(1);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const pageSize = 20;

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, page_size: pageSize };
      if (typeFilter) params.alert_type = typeFilter;
      if (readFilter !== '') params.is_read = readFilter === 'true';

      const res = await api.get('/alerts', { params });
      setAlerts(res.data.items || []);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load alerts';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, readFilter, page]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleMarkRead = async (alertId) => {
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

  const handleDelete = async (alertId) => {
    try {
      await api.post(`/alerts/${alertId}/delete`);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      setTotal((prev) => prev - 1);
    } catch {
      // handled by interceptor
    }
  };

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Alerts</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total} alerts {unreadCount > 0 && `(${unreadCount} unread)`}
          </p>
        </div>
        <Button
          onClick={handleMarkAllRead}
          variant="outline"
          size="md"
          loading={markingAllRead}
          disabled={unreadCount === 0}
          className="self-start sm:self-auto"
        >
          <CheckCheck className="h-4 w-4" />
          <span className="hidden sm:inline">Mark All Read</span>
          <span className="sm:hidden">Mark Read</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="block rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          {ALERT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={readFilter}
          onChange={(e) => { setReadFilter(e.target.value); setPage(1); }}
          className="block rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle className="mb-3 h-10 w-10 text-red-500" />
          <p className="text-sm text-gray-600">{error}</p>
          <Button onClick={fetchAlerts} variant="outline" size="sm" className="mt-3">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BellOff className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">No alerts</p>
          <p className="mt-1 text-sm text-gray-400">You&apos;re all caught up</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl border bg-white p-4 shadow-sm transition-colors ${
                alert.is_read ? 'border-gray-200' : 'border-blue-200 bg-blue-50/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  {getAlertTypeIcon(alert.alert_type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={`text-sm ${alert.is_read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>
                      {alert.title}
                    </h3>
                    <Badge variant={getAlertTypeBadge(alert.alert_type)}>
                      {alert.alert_type.replace('_', ' ')}
                    </Badge>
                    {!alert.is_read && (
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{alert.message}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                    <span>{formatDate(alert.created_at, 'dd MMM yyyy HH:mm')}</span>
                    {alert.tender_title && (
                      <>
                        <span>&middot;</span>
                        <button
                          onClick={() => alert.tender_id && navigate(`/tenders/${alert.tender_id}`)}
                          className="text-blue-600 hover:underline"
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
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(alert.id)}
                    title="Delete"
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500 sm:text-sm">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} alerts
            </p>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              <span className="text-xs text-gray-600 sm:text-sm">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
