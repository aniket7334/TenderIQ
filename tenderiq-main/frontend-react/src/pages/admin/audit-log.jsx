import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Shield,
  AlertTriangle,
  RefreshCw,
  X,
  Download,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import useAuth from '@/hooks/useAuth';

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'All Entity Types' },
  { value: 'auth', label: 'Sign-in & sign-up' },
  { value: 'tender', label: 'Tender' },
  { value: 'source', label: 'Source' },
  { value: 'live_source', label: 'Live source' },
  { value: 'keyword', label: 'Keyword' },
  { value: 'template', label: 'Template' },
  { value: 'user', label: 'User' },
  { value: 'alert', label: 'Alert' },
  { value: 'tender_note', label: 'Tender Note' },
];

/* Plain-English names for the recorded actions (unknown ones are shown as-is) */
const ACTION_LABELS = {
  login: 'Signed in',
  logout: 'Signed out',
  login_failed: 'Failed sign-in',
  login_locked_out: 'Sign-in locked out',
  login_blocked: 'Sign-in refused (account not active)',
  signup_requested: 'Sign-up requested',
  approve_signup: 'Sign-up approved',
  reject_signup: 'Sign-up rejected',
  create_user: 'User created',
  update_user: 'User updated',
  change_role: 'Role changed',
  create_source: 'Source added',
  update_source: 'Source updated',
  delete_source: 'Source deleted',
  update_live_source: 'Live source settings changed',
  sync_now: 'Live source synced',
  scrape_now: 'Scrape started',
  scrape_all: 'Scrape all started',
  create_keyword: 'Keyword added',
  bulk_add_keywords: 'Keywords added (bulk)',
  update_keyword: 'Keyword updated',
  delete_keyword: 'Keyword deleted',
  create_template: 'Template created',
  upload_template: 'Template uploaded',
  update_template: 'Template updated',
  delete_template: 'Template deleted',
  update: 'Tender updated',
  shortlist: 'Shortlist changed',
  add_tag: 'Tag added',
  remove_tag: 'Tag removed',
  add_comment: 'Comment added',
  fetch_details: 'Details fetched',
  generate_note: 'Note generated',
  update_note: 'Note edited',
  export_note: 'Note exported',
  update_alert_settings: 'Alert settings changed',
};
const actionLabel = (action) => ACTION_LABELS[action] || action;
// Security-relevant actions get the stronger badge
const SECURITY_ACTIONS = new Set(['login_failed', 'login_locked_out', 'login_blocked', 'change_role', 'reject_signup']);

export default function AuditLogPage() {
  const navigate = useNavigate();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);

  // Filters
  const [entityType, setEntityType] = useState('');
  const [userId, setUserId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 20;

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState(new Set());

  const isAdmin = currentUser?.role === 'admin' || authLoading;

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page, page_size: pageSize };
      if (entityType) params.entity_type = entityType;
      if (userId) params.user_id = userId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await api.get('/admin/audit-logs', { params });
      setLogs(res.data.items || []);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load audit logs';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [entityType, userId, dateFrom, dateTo, page]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.items || res.data || []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleRow = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setEntityType('');
    setUserId('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = entityType || userId || dateFrom || dateTo;

  /* Export: the entries matching the current filters (up to 5,000) as a CSV file */
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    try {
      setExporting(true);
      const params = { page_size: 1000 };
      if (entityType) params.entity_type = entityType;
      if (userId) params.user_id = userId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const rows = [];
      for (let p = 1; p <= 5; p++) {
        const res = await api.get('/admin/audit-logs', { params: { ...params, page: p } });
        rows.push(...(res.data.items || []));
        if (p >= (res.data.total_pages || 1)) break;
      }
      const cell = (v) => {
        let s = v == null ? '' : String(v);
        // Stop spreadsheet apps from running text that starts like a formula
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const lines = [['Time', 'User', 'Action', 'Entity type', 'Entity ID', 'IP address', 'Details'].join(',')];
      for (const r of rows) {
        lines.push([
          formatDate(r.created_at, 'yyyy-MM-dd HH:mm:ss'),
          r.user_name || 'System',
          actionLabel(r.action),
          r.entity_type,
          r.entity_id || '',
          r.ip_address || '',
          r.changes ? JSON.stringify(r.changes) : '',
        ].map(cell).join(','));
      }
      const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tenderiq-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const getActionBadge = (action) => {
    const label = actionLabel(action);
    if (SECURITY_ACTIONS.has(action)) return <Badge variant="warning">{label}</Badge>;
    if (action.includes('create') || action.includes('add') || action === 'login' || action === 'approve_signup') return <Badge variant="success">{label}</Badge>;
    if (action.includes('delete') || action.includes('remove')) return <Badge variant="danger">{label}</Badge>;
    if (action.includes('update') || action.includes('change') || action.includes('edit')) return <Badge variant="info">{label}</Badge>;
    return <Badge variant="default">{label}</Badge>;
  };

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="text-lg font-medium text-gray-900">Access Denied</p>
        <p className="text-sm text-gray-500">You need admin privileges to access this page.</p>
        <Button onClick={() => navigate('/dashboard')} variant="outline" size="sm">Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Audit Log</h1>
          <p className="mt-1 text-sm text-gray-500">{total} entries</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleExport} variant="outline" size="md" loading={exporting} disabled={exporting || total === 0}>
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button
            variant={showFilters ? 'primary' : 'outline'}
            size="md"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-700">!</span>
            )}
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">Entity Type</label>
              <select
                value={entityType}
                onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {ENTITY_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">User</label>
              <select
                value={userId}
                onChange={(e) => { setUserId(e.target.value); setPage(1); }}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">All Users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">From Date</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-500">To Date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" />
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Data table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertTriangle className="mb-3 h-10 w-10 text-red-500" />
            <p className="text-sm text-gray-600">{error}</p>
            <Button onClick={fetchLogs} variant="outline" size="sm" className="mt-3">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Shield className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">No audit log entries</p>
            <p className="mt-1 text-sm text-gray-400">Activity will appear here</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="w-8 px-2 py-3 sm:px-3" />
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Timestamp</th>
                    <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">User</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:px-6">Action</th>
                    <th className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Entity Type</th>
                    <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Entity ID</th>
                    <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-2 py-4 sm:px-3">
                          {log.changes && Object.keys(log.changes).length > 0 && (
                            <button
                              onClick={() => toggleRow(log.id)}
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${
                                  expandedRows.has(log.id) ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-4 text-xs text-gray-600 sm:px-6 sm:whitespace-nowrap sm:text-sm">
                          {formatDate(log.created_at, 'dd MMM yyyy HH:mm:ss')}
                          <div className="mt-1 text-xs text-gray-500 md:hidden">
                            {log.user_name || (log.user_id ? users.find((u) => String(u.id) === log.user_id)?.full_name : null) || log.user_id || 'System'}
                          </div>
                        </td>
                        <td className="hidden md:table-cell whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {log.user_name || (log.user_id ? users.find((u) => String(u.id) === log.user_id)?.full_name : null) || log.user_id || 'System'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 sm:px-6">
                          {getActionBadge(log.action)}
                        </td>
                        <td className="hidden sm:table-cell whitespace-nowrap px-6 py-4">
                          <Badge variant="default">{(ENTITY_TYPE_OPTIONS.find((o) => o.value === log.entity_type) || {}).label || log.entity_type}</Badge>
                        </td>
                        <td className="hidden lg:table-cell whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-600">
                          {log.entity_id ? `${String(log.entity_id).slice(0, 8)}...` : '-'}
                        </td>
                        <td className="hidden lg:table-cell whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                          {log.ip_address || '-'}
                        </td>
                      </tr>
                      {expandedRows.has(log.id) && log.changes && (
                        <tr>
                          <td colSpan={7} className="bg-gray-50 px-4 py-3 sm:px-10">
                            <div className="rounded-lg bg-white border border-gray-200 p-3 sm:p-4">
                              <h4 className="mb-2 text-xs font-semibold uppercase text-gray-400">Changes</h4>
                              <pre className="overflow-x-auto text-xs text-gray-600 font-mono">
                                {JSON.stringify(log.changes, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-xs text-gray-500 sm:text-sm">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} entries
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
          </>
        )}
      </div>
    </div>
  );
}
